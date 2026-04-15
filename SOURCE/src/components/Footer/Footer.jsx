import { useLanguage } from '../../context/LanguageContext';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>GoldRush</span>
          <p className={styles.tagline}>{t('footer.tagline')}</p>
        </div>
        <div className={styles.links}>
          <a href="#" className={styles.link}>{t('footer.about')}</a>
          <a href="#" className={styles.link}>{t('footer.contact')}</a>
          <a href="#" className={styles.link}>{t('footer.privacy')}</a>
          <a href="#" className={styles.link}>{t('footer.terms')}</a>
        </div>
        <p className={styles.copy}>&copy; {new Date().getFullYear()} GoldRush. {t('footer.copyright').split('©')[1]?.trim()}</p>
      </div>
    </footer>
  );
}
