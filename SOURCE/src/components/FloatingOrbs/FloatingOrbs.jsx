import styles from './FloatingOrbs.module.css';

export default function FloatingOrbs() {
  return (
    <div className={styles.orbs} aria-hidden="true">
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <div className={`${styles.orb} ${styles.orb4}`} />
      <div className={`${styles.orb} ${styles.orb5}`} />
    </div>
  );
}
