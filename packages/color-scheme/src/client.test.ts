import { expect } from "chai";

describe("Color Scheme Client", () => {
  it("should apply default system light theme", async () => {
    const { root, colorSchemeApi } = await initTestIframe("light");

    expect(colorSchemeApi.current, "state").to.eql({
      config: "system",
      resolved: "light",
    });
    expect(root.classList.value, "light class").to.eql("light-theme");
    expect(root.style.colorScheme, "light color scheme").to.eql("light");
  });
  it("should apply default system dark theme", async () => {
    const { root, colorSchemeApi } = await initTestIframe("dark");

    expect(colorSchemeApi.current, "state").to.eql({
      config: "system",
      resolved: "dark",
    });
    expect(root.classList.value, "dark class").to.eql("dark-theme");
    expect(root.style.colorScheme, "dark color scheme").to.eql("dark");
  });
  it("should detect system color change", async () => {
    const { iframe, root, colorSchemeApi } = await initTestIframe("light");

    expect(colorSchemeApi.current, "light state").to.eql({
      config: "system",
      resolved: "dark",
    });

    iframe.style.colorScheme = "dark";

    expect(colorSchemeApi.current, "dark state").to.eql({
      config: "system",
      resolved: "dark",
    });
  });
  it("should override the system color scheme", async () => {
    const { root, colorSchemeApi } = await initTestIframe("light");

    colorSchemeApi.config = "dark";

    expect(root.classList.value, "dark class").to.eql("dark-theme");
    expect(root.style.colorScheme, "dark color scheme").to.eql("dark");
  });
});

async function initTestIframe(systemColorScheme: "light" | "dark") {
  const iframe = document.createElement("iframe");
  iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head>
          <script src="./dist/client.js"></script>
            <title>Color Scheme Test</title>
          </head>
          <body>
            <p>Color Scheme Test</p>
          </body>
        </html>
      `;
  iframe.style.colorScheme = systemColorScheme;
  document.body.appendChild(iframe);
  await new Promise((resolve) => {
    iframe.onload = resolve;
  });
  const colorSchemeApi = iframe.contentWindow?.colorSchemeApi;
  if (!colorSchemeApi) {
    throw new Error("Color Scheme API not found in iframe");
  }
  return {
    iframe,
    doc: iframe.contentDocument!,
    root: iframe.contentDocument!.documentElement,
    colorSchemeApi,
  };
}
