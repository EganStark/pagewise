import sharp from "sharp";

const icon = (size, maskable = false) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6f452f"/><stop offset="1" stop-color="#211712"/></linearGradient><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0b77e"/><stop offset="1" stop-color="#d8894e"/></linearGradient></defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 104}" fill="url(#wood)"/>
  <path d="M0 116h512M0 252h512M0 388h512" stroke="#b47a52" stroke-opacity=".12" stroke-width="10"/>
  <path d="M116 142c52-18 99-8 140 27v225c-42-34-88-43-140-25V142Z" fill="url(#paper)"/>
  <path d="M396 142c-52-18-99-8-140 27v225c42-34 88-43 140-25V142Z" fill="#e0995e"/>
  <path d="M256 170v224" stroke="#6b3d27" stroke-width="12" stroke-linecap="round"/>
  <path d="M318 137v126l27-18 27 18V139c-18-4-36-5-54-2Z" fill="#7f302a"/>
  <path d="M130 396c50-15 91-5 126 20 35-25 76-35 126-20" fill="none" stroke="#f3d1aa" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/>
</svg>`);

await Promise.all([
  sharp(icon(192)).png().toFile("public/icon-192.png"),
  sharp(icon(512)).png().toFile("public/icon-512.png"),
  sharp(icon(512, true)).png().toFile("public/icon-maskable-512.png"),
  sharp(icon(180)).png().toFile("public/apple-touch-icon.png"),
  sharp(icon(64)).resize(64, 64).png().toFile("public/favicon-64.png"),
]);
