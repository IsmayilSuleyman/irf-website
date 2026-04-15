import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar/Navbar';
import Cart from './components/Cart/Cart';
import FloatingOrbs from './components/FloatingOrbs/FloatingOrbs';
import Footer from './components/Footer/Footer';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage/HomePage';
import ProductPage from './pages/ProductPage/ProductPage';
import CheckoutPage from './pages/CheckoutPage/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage/OrderConfirmationPage';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <CartProvider>
            <FloatingOrbs />
            <Navbar />
            <ScrollToTop />
            <main style={{ flex: 1, paddingTop: '70px' }}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/product/:id" element={<ProductPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
              </Routes>
            </main>
            <Footer />
            <Cart />
          </CartProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
