import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../../context/LanguageContext';
import styles from './OrderConfirmationPage.module.css';

export default function OrderConfirmationPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const order = state?.order;

  useEffect(() => {
    if (!order) navigate('/');
  }, [order, navigate]);

  if (!order) return null;

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Success icon */}
        <motion.div
          className={styles.iconWrap}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>

        <h1 className={styles.title}>{t('confirmation.thankYou')}</h1>
        <p className={styles.subtitle}>{t('confirmation.subtitle')}</p>

        <div className={styles.orderIdBox}>
          <span className={styles.orderIdLabel}>{t('confirmation.orderId')}</span>
          <span className={styles.orderId}>{order.id}</span>
        </div>

        {/* Items */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('confirmation.itemsOrdered')}</h3>
          <ul className={styles.items}>
            {order.items.map(({ product, quantity }) => (
              <li key={product.id} className={styles.item}>
                <img src={product.image} alt={product.name} className={styles.itemImg} />
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{product.name}</span>
                  <span className={styles.itemQty}>× {quantity}</span>
                </div>
                <span className={styles.itemPrice}>
                  {(product.price * quantity).toFixed(2)} ₼
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.totalRow}>
            <span>{t('confirmation.total')}</span>
            <span className={styles.totalPrice}>{order.total.toFixed(2)} ₼</span>
          </div>
        </div>

        {/* Shipping */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('confirmation.shippingTo')}</h3>
          <p className={styles.address}>
            {order.contact.fullName}<br />
            {order.shipping.address}<br />
            {order.shipping.city}, {order.shipping.postalCode}<br />
            {order.shipping.country}
          </p>
        </div>

        {/* How we'll reach you */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('confirmation.contactVia')}</h3>
          <div className={styles.contactList}>
            <p className={styles.contactRow}>✉️ {order.contact.email}</p>
            <p className={styles.contactRow}>📞 {order.contact.phone}</p>
            {order.contact.whatsapp && <p className={styles.contactRow}>💬 WhatsApp: {order.contact.whatsapp}</p>}
            {order.contact.telegram && <p className={styles.contactRow}>✈️ Telegram: {order.contact.telegram}</p>}
            {order.contact.otherContact && <p className={styles.contactRow}>🔗 {order.contact.otherContact}</p>}
          </div>
        </div>

        <Link to="/" className={styles.continueBtn}>
          {t('confirmation.continueShopping')}
        </Link>
      </motion.div>
    </div>
  );
}
