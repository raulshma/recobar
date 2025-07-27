import { render } from '@testing-library/react';
import App from '../renderer/App';

describe('App', () => {
  it('should render', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
