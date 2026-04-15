import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import CartItem from '../CartItem/CartItem';
import styles from './Cart.module.css';

export default function Cart() {
  const { items, isOpen, closeCart, cartTotal, cartCount } = useCart();
  const { t } = useLanguage();
  const navigate = useNavigate();

  function handleCheckout() {
    closeCart();
    navigate('/checkout');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />
          <motion.div
            className={styles.panel}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>{t('cart.title')} ({cartCount})</h2>
              <button className={styles.closeBtn} onClick={closeCart} aria-label="Close cart">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.items}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <p>{t('cart.empty')}</p>
                  <button className={styles.shopBtn} onClick={closeCart}>{t('cart.continueShopping')}</button>
                </div>
              ) : (
                items.map(item => (
                  <CartItem key={item.product.id} item={item} />
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className={styles.footer}>
                <div className={styles.totalRow}>
                  <span>{t('cart.total')}</span>
                  <span className={styles.totalPrice}>{cartTotal.toFixed(2)} ₼</span>
                </div>
                <button className={styles.checkoutBtn} onClick={handleCheckout}>{t('cart.checkout')}</button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
