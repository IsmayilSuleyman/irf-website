import { createContext, useContext, useReducer, useMemo } from 'react';

const CartContext = createContext();

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(item => item.product.id === action.product.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map(item =>
            item.product.id === action.product.id
              ? { ...item, quantity: item.quantity + (action.quantity || 1) }
              : item
          ),
          isOpen: true
        };
      }
      return {
        ...state,
        items: [...state.items, { product: action.product, quantity: action.quantity || 1 }],
        isOpen: true
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.product.id !== action.id)
      };
    case 'UPDATE_QUANTITY':
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item.product.id !== action.id)
        };
      }
      return {
        ...state,
        items: state.items.map(item =>
          item.product.id === action.id
            ? { ...item, quantity: action.quantity }
            : item
        )
      };
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };
    case 'CLOSE_CART':
      return { ...state, isOpen: false };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  const addItem = (product, quantity = 1) => dispatch({ type: 'ADD_ITEM', product, quantity });
  const removeItem = (id) => dispatch({ type: 'REMOVE_ITEM', id });
  const updateQuantity = (id, quantity) => dispatch({ type: 'UPDATE_QUANTITY', id, quantity });
  const toggleCart = () => dispatch({ type: 'TOGGLE_CART' });
  const closeCart = () => dispatch({ type: 'CLOSE_CART' });
  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const cartCount = useMemo(() => state.items.reduce((sum, item) => sum + item.quantity, 0), [state.items]);
  const cartTotal = useMemo(() => state.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [state.items]);

  return (
    <CartContext.Provider value={{
      items: state.items,
      isOpen: state.isOpen,
      addItem,
      removeItem,
      updateQuantity,
      toggleCart,
      closeCart,
      clearCart,
      cartCount,
      cartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
