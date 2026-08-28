import sharp from "sharp";

const logo = "public/favicon.svg";
const render = (size, output) =>
  sharp(logo).resize(size, size).png().toFile(output);

await Promise.all([
  render(192, "public/icon-192.png"),
  render(512, "public/icon-512.png"),
  render(512, "public/icon-maskable-512.png"),
  render(180, "public/apple-touch-icon.png"),
  render(64, "public/favicon-64.png"),
]);
