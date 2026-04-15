import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import products from '../../data/products';
import styles from './ProductPage.module.css';

export default function ProductPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const product = products.find(p => p.id === Number(id));

  if (!product) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>
          <h2>{t('common.productNotFound')}</h2>
          <Link to="/" className={styles.backLink}>{t('productPage.back')}</Link>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const renderStars = (rating) => {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    for (let i = 0; i < 5; i++) {
      if (i < full) stars.push(<span key={i} className={styles.starFull}>&#9733;</span>);
      else if (i === full && hasHalf) stars.push(<span key={i} className={styles.starHalf}>&#9733;</span>);
      else stars.push(<span key={i} className={styles.starEmpty}>&#9733;</span>);
    }
    return stars;
  };

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {t('productPage.back')}
      </Link>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className={styles.imageWrap}>
          <img src={product.image} alt={product.name} className={styles.image} />
          {product.badge && <span className={styles.badge}>{product.badge}</span>}
        </div>

        <div className={styles.details}>
          <span className={styles.category}>{product.category}</span>
          <h1 className={styles.name}>{product.name}</h1>
          <div className={styles.stars}>
            {renderStars(product.rating)}
            <span className={styles.ratingText}>{product.rating}</span>
          </div>
          <p className={styles.price}>{product.price.toFixed(2)} ₼</p>
          <p className={styles.stock}>{product.stock} {t('stock.inStock')}</p>
          <p className={styles.description}>{product.description}</p>

          <div className={styles.actions}>
            <div className={styles.quantity}>
              <button
                className={styles.qtyBtn}
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className={styles.qtyValue}>{quantity}</span>
              <button
                className={styles.qtyBtn}
                onClick={() => setQuantity(q => q + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              className={`${styles.addBtn} ${added ? styles.added : ''}`}
              onClick={handleAdd}
            >
              {added ? t('productPage.added') : t('productPage.addToCart')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
