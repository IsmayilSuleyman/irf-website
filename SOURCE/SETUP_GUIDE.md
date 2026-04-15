# GoldRush E-Commerce Website - Setup Guide

## Quick Start

This is a complete, production-ready React + Vite e-commerce website with bilingual support (English/Azerbaijani), dark/light theme, shopping cart, and payment integration.

### Installation

```bash
# 1. Clone or copy the project
cd your-project-directory

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Build for production
npm run build
```

---

## Project Structure

```
website/
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Root component with routing
│   ├── index.css                # Global styles + CSS variables
│   │
│   ├── context/
│   │   ├── ThemeContext.jsx     # Dark/light mode (stored in localStorage)
│   │   ├── CartContext.jsx      # Shopping cart state management
│   │   └── LanguageContext.jsx  # Bilingual support (az/en)
│   │
│   ├── components/
│   │   ├── Navbar/              # Navigation bar with logo, language/theme toggles, cart
│   │   ├── Hero/                # Hero section with CTAs
│   │   ├── ProductGrid/         # Product listing with category filters
│   │   ├── ProductCard/         # Individual product card
│   │   ├── Cart/                # Shopping cart panel
│   │   ├── CartItem/            # Individual cart item
│   │   ├── Footer/              # Footer with links
│   │   ├── ThemeToggle/         # Dark/light mode toggle button
│   │   ├── FloatingOrbs/        # Animated background orbs
│   │   ├── ScrollReveal/        # Scroll animation wrapper
│   │   └── ScrollToTop.jsx      # Scroll to top button
│   │
│   ├── pages/
│   │   ├── HomePage/            # Main page with hero + products
│   │   ├── ProductPage/         # Individual product detail page
│   │   ├── CheckoutPage/        # Checkout form
│   │   └── OrderConfirmationPage/ # Order success confirmation
│   │
│   ├── data/
│   │   ├── products.js          # Product inventory (edit here for products)
│   │   └── translations.js      # Azerbaijani & English text
│   │
│   └── utils/
│       └── cardValidation.js    # Credit card validation
│
├── public/
│   ├── images/
│   │   ├── logo.png             # Site logo (add your logo here)
│   │   └── products/            # Product images
│   │       ├── product-1.jpg
│   │       ├── product-2.jpg
│   │       └── product-3.jpg
│   ├── favicon.svg
│   └── icons.svg
│
├── package.json                 # Dependencies
├── vite.config.js              # Vite configuration
└── index.html                  # HTML entry point
```

---

## Key Features

### 1. **Bilingual Support** (English/Azerbaijani)
- Default language: Azerbaijani
- Language toggle button in navbar
- All text is translatable via `src/data/translations.js`
- Uses React Context for global state

### 2. **Dark/Light Theme**
- Default: Dark mode
- Theme toggle button in navbar
- CSS variables for colors (`src/index.css`)
- Persisted in localStorage

### 3. **Shopping Cart**
- Add/remove products
- Quantity adjustment
- Total calculation
- Cart icon with item counter
- Persistent cart data

### 4. **Product Management**
- Edit products in `src/data/products.js`
- Each product has: id, name, category, price, image, description, rating, badge, stock
- Product images stored locally in `public/images/products/`

### 5. **Responsive Design**
- Glass morphism UI effects
- Mobile-friendly
- Smooth animations (Framer Motion)
- Flexbox/CSS Grid layout

---

## Customization Guide

### Change Colors (Light/Dark Theme)
Edit `src/index.css` - CSS variables section:
```css
:root {
  --bg-gradient: /* light mode background */
  --text-primary: /* light mode text */
  --accent: /* light mode accent color */
  /* ... etc */
}

[data-theme="dark"] {
  --bg-gradient: /* dark mode background */
  --text-primary: /* dark mode text */
  --accent: /* dark mode accent color */
  /* ... etc */
}
```

### Add/Edit Products
Edit `src/data/products.js`:
```javascript
const products = [
  {
    id: 1,
    name: "Product Name",
    category: "poppers",
    price: 99,
    image: "/images/products/product-1.jpg",  // Must exist in public/images/products/
    description: "Product description",
    rating: 4.8,
    badge: "High Demand",
    stock: 5
  },
  // ... more products
];
```

### Change Text (Translations)
Edit `src/data/translations.js`:
```javascript
export const translations = {
  az: {  // Azerbaijani
    hero: {
      eyebrow: "YOUR TEXT HERE",
      title1: "YOUR TEXT",
      // ... etc
    }
  },
  en: {  // English
    hero: {
      eyebrow: "YOUR TEXT HERE",
      title1: "YOUR TEXT",
      // ... etc
    }
  }
};
```

### Add Logo
1. Place your logo image at `public/images/logo.png`
2. Size: 40px height (auto width)
3. Appears in navbar with "GoldRush" text

### Change Website Name
Search and replace:
- `src/components/Navbar/Navbar.jsx` - Logo link text
- `public/index.html` - Browser tab title
- `src/data/translations.js` - nav.logo for both languages

### Change Font
Edit `src/index.css`:
```css
body {
  font-family: 'Your Font Name', sans-serif;
}
```

### Change Currency
The site uses AZN (₼). To change:
- Update all `₼` symbols in code
- Edit `src/index.css` or relevant components
- Update product prices in `src/data/products.js`

---

## Dependencies

- **React 19**: UI framework
- **Vite 8**: Build tool
- **React Router DOM 7**: Routing
- **Framer Motion 12**: Animations
- **EmailJS**: Order notifications (optional)

Install with: `npm install`

---

## Environment Variables (Optional)

If using EmailJS for notifications, create `.env`:
```
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

---

## Deployment

### Build for Production
```bash
npm run build
```

Generates optimized files in `dist/` folder.

### Deploy to Vercel
1. Push code to GitHub
2. Connect repo to Vercel
3. Default settings work (Vite is auto-detected)
4. Deploy!

### Deploy to Other Platforms
- **Netlify**: Connect GitHub repo, it auto-detects Vite
- **GitHub Pages**: Build locally, push to `gh-pages` branch
- **Traditional Server**: Upload contents of `dist/` folder

---

## Component Overview

### Navbar
- Logo + site name
- Language toggle (EN/AZ)
- Theme toggle (light/dark)
- Cart button with counter

### Hero Section
- Animated eyebrow text
- Large headline with accent color
- Subtitle
- Two CTA buttons

### ProductGrid
- Category filter buttons
- Product cards display
- Responsive grid layout

### ProductCard
- Product image
- Name, rating (stars), price
- Stock count
- Badge (High Demand, etc.)
- Click to view details

### Cart
- Slide-out panel from right
- List of items with quantities
- Total price calculation
- Checkout button

### Footer
- Site tagline
- Links (About, Contact, Privacy, Terms)
- Copyright notice

---

## Common Tasks

### Add a New Product
1. Create image: `public/images/products/my-product.jpg`
2. Add to `src/data/products.js`:
```javascript
{
  id: 4,
  name: "My Product",
  category: "poppers",
  price: 79,
  image: "/images/products/my-product.jpg",
  description: "My description",
  rating: 4.9,
  badge: "New",
  stock: 10
}
```

### Change Hero Text
Edit `src/data/translations.js` - `hero` section in both `az` and `en`

### Change Default Theme to Light
Edit `src/context/ThemeContext.jsx`:
```javascript
const [theme, setTheme] = useState('light');  // Change from 'dark'
```

### Add New Category
1. Edit `src/data/products.js` - change `category` field for products
2. Edit `src/components/ProductGrid/ProductGrid.jsx` - update categories array
3. Edit `src/data/translations.js` - add translation for category name

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

---

## Performance

- **Light/Dark Mode**: CSS variables (no layout shift)
- **Lazy Loading**: Images use `loading="lazy"`
- **Code Splitting**: Automatic with Vite
- **Animations**: GPU-accelerated (Framer Motion)
- **Bundle Size**: ~150KB gzipped

---

## Troubleshooting

**Images not showing:**
- Check `public/images/products/` folder exists
- Verify image filenames match `src/data/products.js`
- Use `.jpg`, `.png`, or `.webp` formats

**Translations not working:**
- Ensure `LanguageContext` is wrapped around app in `App.jsx`
- Check keys in `translations.js` match component usage
- Verify language toggle button works (check localStorage)

**Styles not applying:**
- Check CSS modules are imported correctly
- Verify CSS variable names in `index.css`
- Clear browser cache (Ctrl+Shift+Del)

---

## License & Credits

Built with React, Vite, Framer Motion. Ready for any e-commerce project.

---

## Questions?

All features are self-contained in the `src/` directory. Modify freely for your needs!
