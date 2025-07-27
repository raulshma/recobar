import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { BarcodeVideoRecorderApp } from '../components/app';
import './App.scss';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BarcodeVideoRecorderApp />} />
      </Routes>
    </Router>
  );
}
