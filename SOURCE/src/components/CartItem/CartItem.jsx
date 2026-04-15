import { useCart } from '../../context/CartContext';
import styles from './CartItem.module.css';

export default function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCart();
  const { product, quantity } = item;

  return (
    <div className={styles.item}>
      <img src={product.image} alt={product.name} className={styles.image} />
      <div className={styles.info}>
        <h4 className={styles.name}>{product.name}</h4>
        <p className={styles.price}>{product.price.toFixed(2)} ₼</p>
        <div className={styles.controls}>
          <button
            className={styles.qtyBtn}
            onClick={() => updateQuantity(product.id, quantity - 1)}
            aria-label="Decrease"
          >
            -
          </button>
          <span className={styles.qty}>{quantity}</span>
          <button
            className={styles.qtyBtn}
            onClick={() => updateQuantity(product.id, quantity + 1)}
            aria-label="Increase"
          >
            +
          </button>
        </div>
      </div>
      <button
        className={styles.remove}
        onClick={() => removeItem(product.id)}
        aria-label="Remove item"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
