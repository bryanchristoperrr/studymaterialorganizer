import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { CoursesPage } from '@/pages/CoursesPage';
import { MaterialCreatePage } from '@/pages/MaterialCreatePage';
import { MaterialDetailPage } from '@/pages/MaterialDetailPage';
import { MaterialEditPage } from '@/pages/MaterialEditPage';
import { MaterialListPage } from '@/pages/MaterialListPage';

/**
 * Routing aplikasi. Halaman dimuat eager (sederhana & cukup untuk jumlah
 * halaman saat ini); code-splitting dapat ditambahkan bila halaman bertambah.
 */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/materials" replace />} />
        <Route path="/materials" element={<MaterialListPage />} />
        <Route path="/materials/new" element={<MaterialCreatePage />} />
        <Route path="/materials/:id" element={<MaterialDetailPage />} />
        <Route path="/materials/:id/edit" element={<MaterialEditPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="*" element={<Navigate to="/materials" replace />} />
      </Route>
    </Routes>
  );
}
