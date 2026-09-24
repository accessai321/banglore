import '@testing-library/jest-dom';

jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => children,
    Routes: ({ children }) => children,
    Route: ({ element }) => element,
    Navigate: () => null,
    useParams: () => ({}),
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/' }),
    Link: ({ children, to }) => children,
  }),
  { virtual: true }
);
jest.mock('./components/Avatar3DCanvas', () => () => null);
