import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { toggleCart, cartCount } = useCart();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <img src="/images/logo.png" alt="GoldRush" style={{ height: '40px', width: 'auto' }} />
          <span>GoldRush</span>
        </Link>

        <div className={styles.actions}>
          <button
            className={styles.langBtn}
            onClick={toggleLanguage}
            aria-label="Toggle language"
            title={language === 'az' ? t('languages.english') : t('languages.azerbaijani')}
          >
            {language === 'az' ? 'EN' : 'AZ'}
          </button>
          <ThemeToggle />
          <button className={styles.cartBtn} onClick={toggleCart} aria-label="Open cart">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
          </button>
        </div>
      </div>
    </nav>
  );
}
