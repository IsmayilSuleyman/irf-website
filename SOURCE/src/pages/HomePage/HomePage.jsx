import { useLanguage } from '../../context/LanguageContext';
import Hero from '../../components/Hero/Hero';
import ProductGrid from '../../components/ProductGrid/ProductGrid';
import ScrollReveal from '../../components/ScrollReveal/ScrollReveal';
import products from '../../data/products';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div>
      <Hero />
      <section id="products" className={styles.section}>
        <div className={styles.container}>
          <ScrollReveal>
            <h2 className={styles.heading}>{t('home.heading')}</h2>
            <p className={styles.subheading}>{t('home.subheading')}</p>
          </ScrollReveal>
          <ProductGrid products={products} />
        </div>
      </section>
    </div>
  );
}
