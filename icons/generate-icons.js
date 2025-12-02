// Icon generation script
// Requires: npm install sharp

const sharp = require('sharp');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = './icon.svg';

async function generateIcons() {
  for (const size of sizes) {
    const output = `./icon-${size}x${size}.png`;
    
    try {
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(output);
      
      console.log(`Generated ${output}`);
    } catch (error) {
      console.error(`Failed to generate ${output}:`, error.message);
    }
  }
}

generateIcons().then(() => {
  console.log('All icons generated successfully!');
}).catch((error) => {
  console.error('Icon generation failed:', error);
});
