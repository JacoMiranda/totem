import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Devices } from './pages/Devices';
import { Login } from './pages/Login';
import { ManifestationDetail } from './pages/ManifestationDetail';
import { ManifestationsList } from './pages/ManifestationsList';

/**
 * Painel administrativo (Fase 4) - SPA React consumindo a API Laravel
 * (Sanctum bearer, ver lib/api.ts). Servido por qualquer rota `/admin/*`
 * (ver routes/web.php) - react-router-dom faz o roteamento client-side
 * de verdade a partir daí.
 */
function App() {
  return (
    <Router basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/manifestacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <ManifestationsList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manifestacoes/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ManifestationDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispositivos"
          element={
            <ProtectedRoute>
              <Layout>
                <Devices />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/manifestacoes" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
