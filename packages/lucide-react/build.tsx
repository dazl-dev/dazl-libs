import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { nodeFs } from '@file-services/node';
import * as lucideReact from 'lucide-react';

interface IconData {
    name: string;
    aliases: string[];
    svgString: string;
}

interface IconTypeAugmentation {
    name: string;
    aliases: string[];
    file: string;
}

interface TypeAugmentationFile {
    icons: IconTypeAugmentation[];
}

function buildIcons(): void {
    const distDir = nodeFs.join(import.meta.dirname, 'dist');
    const svgDir = nodeFs.join(distDir, 'svg');

    nodeFs.ensureDirectorySync(distDir);
    nodeFs.ensureDirectorySync(svgDir);

    const svgsByContent = new Map<string, IconData>();

    for (const [exportName, IconComponent] of Object.entries(lucideReact)) {
        // Skip non-component exports
        if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
            continue;
        }

        if (!IconComponent) {
            continue;
        }

        // Skip known utility functions
        if (exportName === 'createLucideIcon' || exportName === 'Icon') {
            continue;
        }

        // Icon components have uppercase first letter
        if (exportName[0] !== exportName[0]?.toUpperCase()) {
            continue;
        }

        try {
            const svgString = renderToStaticMarkup(
                React.createElement(IconComponent as React.ComponentType<{ size: number; strokeWidth: number }>, {
                    size: 24,
                    strokeWidth: 2,
                }),
            );

            // Check if we've seen this SVG content before
            if (svgsByContent.has(svgString)) {
                const existing = svgsByContent.get(svgString)!;
                // Keep the shortest name
                if (exportName.length < existing.name.length) {
                    existing.aliases.push(existing.name);
                    existing.name = exportName;
                } else {
                    existing.aliases.push(exportName);
                }
            } else {
                svgsByContent.set(svgString, {
                    name: exportName,
                    aliases: [exportName],
                    svgString,
                });
            }
        } catch {
            // Skip icons that fail to render
            continue;
        }
    }

    const iconsTypeAugmentation: IconTypeAugmentation[] = [];

    // Save unique SVGs and build icons list
    for (const { name, aliases, svgString } of svgsByContent.values()) {
        const filename = `${name.toLowerCase()}.svg`;
        const filepath = nodeFs.join(svgDir, filename);

        // Save SVG file
        nodeFs.writeFileSync(filepath, svgString);

        // Add to icons list (use relative path from dist folder)
        const iconEntry = {
            name: name,
            aliases: aliases,
            file: `svg/${filename}`,
        };

        iconsTypeAugmentation.push(iconEntry);
    }

    // Save type augmentation file
    const typeAugmentationFile: TypeAugmentationFile = {
        icons: iconsTypeAugmentation,
    };
    const typeAugmentationPath = nodeFs.join(distDir, 'types-augmentation.json');
    nodeFs.writeFileSync(typeAugmentationPath, JSON.stringify(typeAugmentationFile, null, 2));
}

export default buildIcons;
