import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ProductCard from '../ProductCard/ProductCard';
import ScrollReveal from '../ScrollReveal/ScrollReveal';
import styles from './ProductGrid.module.css';

const categories = ['all', 'poppers'];

export default function ProductGrid({ products }) {
  const [active, setActive] = useState('all');
  const { t } = useLanguage();

  const filtered = active === 'all'
    ? products
    : products.filter(p => p.category === active);

  const getCategoryLabel = (cat) => {
    if (cat === 'all') return t('productGrid.all');
    if (cat === 'poppers') return t('productGrid.poppers');
    return cat;
  };

  return (
    <div>
      <div className={styles.filters}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${active === cat ? styles.active : ''}`}
            onClick={() => setActive(cat)}
          >
            {getCategoryLabel(cat)}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {filtered.map((product, i) => (
          <ScrollReveal key={product.id} delay={i * 0.08}>
            <ProductCard product={product} />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
