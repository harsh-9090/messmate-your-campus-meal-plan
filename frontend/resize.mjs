import sharp from 'sharp';

async function resize() {
  await sharp('assets/icon.png')
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
    })
    .toFile('assets/icon_square.png');
  console.log('Resized to 1024x1024');
}

resize();
