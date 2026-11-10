#!/usr/bin/env node
/* Builds snipcart.json from products.json, so prices live in ONE place.
   Snipcart's order validation fetches this file (the product's data-item-url) and compares id and price with the cart.
   It has to be a static JSON file because the product pages are rendered by JavaScript, which Snipcart's HTML crawler cannot read.

   Run from the repository root:   node scripts/build-snipcart-json.js
   Then commit snipcart.json together with products.json.

   Item ids (must match js/product.js):
     coffee      <product id>-<size without spaces>   e.g. canale-blend-250g, canale-blend-1kg   (the size changes the price)
     accessory   <product id>                         e.g. tostino-mug
   Grind and mug colour are custom fields without a price change, so they are not part of the validation file.
   No dependencies, Node 14+. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(root, 'products.json'), 'utf8'));
const config = fs.readFileSync(path.join(root, 'js', 'config.js'), 'utf8');
const siteUrl = (config.match(/siteUrl:\s*'([^']+)'/) || [])[1];
if (!siteUrl) { console.error('Could not read siteUrl from js/config.js'); process.exit(1); }
const url = siteUrl.replace(/\/?$/, '/') + 'snipcart.json';

const items = [];
for (const p of products.products) {
  if (p.sizes) {
    for (const s of p.sizes) items.push({ id: `${p.id}-${s.label.toLowerCase().replace(/\s+/g, '')}`, price: Number(s.price.toFixed(2)), url });
  } else {
    items.push({ id: p.id, price: Number(p.price.toFixed(2)), url });
  }
}

const ids = new Set(items.map((i) => i.id));
if (ids.size !== items.length) { console.error('Duplicate item ids, check products.json'); process.exit(1); }

fs.writeFileSync(path.join(root, 'snipcart.json'), JSON.stringify(items, null, 2) + '\n');
console.log(`snipcart.json written: ${items.length} items`);
