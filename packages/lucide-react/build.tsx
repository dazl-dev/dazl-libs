import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { nodeFs} from '@file-services/node';
import * as lucideReact from 'lucide-react';


interface IconData {
  name: string;
  aliases: string[];
  svgString: string;
}

interface IconListEntry {
  name: string;
  aliases: string[];
  file: string;
}

function buildIcons(): void {
  const distDir = nodeFs.join(__dirname, 'dist');
  
  nodeFs.ensureDirectorySync(distDir);
  

  const svgsByContent = new Map<string, IconData>();

  console.log('Processing Lucide React icons...');

  // Process all exports from lucide-react
  console.log(`Found ${Object.keys(lucideReact).length} exports from lucide-react`);
  
  // Debug: show first few exports
  const exports = Object.keys(lucideReact);
  console.log('First 10 exports:', exports.slice(0, 10));
  console.log('Sample export types:', exports.slice(0, 5).map(name => `${name}: ${typeof (lucideReact as any)[name]}`));
  
  // Debug first icon structure
  const firstIcon = (lucideReact as any)['AArrowDown'];
  if (firstIcon) {
    console.log('First icon structure:', JSON.stringify(firstIcon, null, 2));
    console.log('First icon keys:', Object.keys(firstIcon));
    if (firstIcon.type) {
      console.log('First icon type:', typeof firstIcon.type, firstIcon.type);
    }
  }
  
  for (const [exportName, IconComponent] of Object.entries(lucideReact)) {
    // Skip non-component exports - React components can be objects or functions
    if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {
      continue;
    }

    // Skip if it's null or undefined
    if (!IconComponent) {
      continue;
    }

    // Skip known utility functions
    if (exportName === 'createLucideIcon' || exportName === 'Icon') {
      continue;
    }

    // Additional check: icon components typically have uppercase first letter
    if (exportName[0] !== exportName[0].toUpperCase()) {
      continue;
    }

    console.log(`Processing: ${exportName}`);

    try {
      let svgString: string;
      
      // Check if it's a forwardRef component with render function
      if (IconComponent && typeof IconComponent === 'object' && 'render' in IconComponent) {
        // Create a wrapper component that properly renders the forwardRef
   
        svgString = renderToStaticMarkup(<IconComponent size={24} strokeWidth={2} />);
      } else if (typeof IconComponent === 'function') {
        // For regular component functions, create element normally
        svgString = renderToStaticMarkup(<IconComponent size={24} strokeWidth={2} />);
      } else {
        // Skip if we can't determine how to render it
        console.warn(`Skipping ${exportName}: unknown type`);
        continue;
      }
      
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
          svgString
        });
      }
      
    } catch (error) {
      console.warn(`Failed to render ${exportName}:`, (error as Error).message);
    }
  }

  const iconsList: IconListEntry[] = [];

  // Save unique SVGs and build icons list
  for (const { name, aliases, svgString } of svgsByContent.values()) {
    const filename = `${name.toLowerCase()}.svg`;
    const filepath = nodeFs.join(distDir, filename);
    
    // Save SVG file
    nodeFs.writeFileSync(filepath, svgString);
    
    // Add to icons list
    iconsList.push({
      name: name,
      aliases: aliases,
      file: filename
    });
  }

  // Save icons list JSON
  const iconsListPath = nodeFs.join(distDir, 'icons-list.json');
  nodeFs.writeFileSync(iconsListPath, JSON.stringify(iconsList, null, 2));

  console.log(`Generated ${iconsList.length} unique icons`);
  console.log(`Total aliases processed: ${iconsList.reduce((sum, icon) => sum + icon.aliases.length, 0)}`);
  console.log('Build complete!');
}

if (require.main === module) {
  buildIcons();
}

export default buildIcons;
