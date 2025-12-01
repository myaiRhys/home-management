# PWA Icons

## Generate Icons

To generate the PWA icons from the icon.svg file, you can use one of these methods:

### Method 1: Using ImageMagick (if installed)

```bash
convert -background none -resize 72x72 icon.svg icon-72x72.png
convert -background none -resize 96x96 icon.svg icon-96x96.png
convert -background none -resize 128x128 icon.svg icon-128x128.png
convert -background none -resize 144x144 icon.svg icon-144x144.png
convert -background none -resize 152x152 icon.svg icon-152x152.png
convert -background none -resize 192x192 icon.svg icon-192x192.png
convert -background none -resize 384x384 icon.svg icon-384x384.png
convert -background none -resize 512x512 icon.svg icon-512x512.png
```

### Method 2: Using Inkscape (if installed)

```bash
for size in 72 96 128 144 152 192 384 512; do
  inkscape -w $size -h $size icon.svg -o icon-${size}x${size}.png
done
```

### Method 3: Online Tools

1. Go to https://realfavicongenerator.net/
2. Upload icon.svg
3. Download the generated icons
4. Replace the PNG files in this directory

### Method 4: Using Node.js script

```bash
npm install sharp
node generate-icons.js
```

## Temporary Placeholders

For development, placeholder PNGs have been created. Replace them with proper icons before production deployment.
