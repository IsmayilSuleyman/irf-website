import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }) {
  const { t } = useLanguage();
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
    <Link to={`/product/${product.id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        <img src={product.image} alt={product.name} className={styles.image} loading="lazy" />
        {product.badge && <span className={styles.badge}>{product.badge}</span>}
      </div>
      <div className={styles.info}>
        <span className={styles.category}>{product.category}</span>
        <h3 className={styles.name}>{product.name}</h3>
        <div className={styles.stars}>{renderStars(product.rating)}</div>
        <p className={styles.price}>{product.price.toFixed(2)} ₼</p>
        <p className={styles.stock}>{product.stock} {t('stock.inStock')}</p>
      </div>
    </Link>
  );
}
