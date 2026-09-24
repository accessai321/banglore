import { render, screen } from '@testing-library/react';
import App, { getPersistedRoute, saveCurrentRoute } from './App';

beforeEach(() => {
  window.localStorage.clear();
});

test('renders AccessAI app', () => {
  render(<App />);
  const titleElement = screen.getByText(/Welcome to AccessAI/i);
  expect(titleElement).toBeInTheDocument();
});

test('persists and restores the last route', () => {
  saveCurrentRoute('/blind');
  expect(getPersistedRoute()).toBe('/blind');

  saveCurrentRoute('/motor/settings');
  expect(getPersistedRoute()).toBe('/motor/settings');
});
