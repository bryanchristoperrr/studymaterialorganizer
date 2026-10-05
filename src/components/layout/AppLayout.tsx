import { NavLink, Outlet } from 'react-router-dom';

/**
 * Kerangka aplikasi: header + area konten.
 * Header berisi logo, judul, dan navigasi utama.
 * NavLink otomatis menambah kelas .active pada route yang cocok.
 */
export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-header__title">
          <span className="app-header__logo" aria-hidden="true">
            📚
          </span>
          Study Material Organizer
        </span>
        <nav className="app-header__nav" aria-label="Navigasi utama">
          <NavLink to="/materials" className={({ isActive }) => (isActive ? 'active' : '')}>
            Materi
          </NavLink>
          <NavLink to="/materials/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            Tambah
          </NavLink>
          <NavLink to="/courses" className={({ isActive }) => (isActive ? 'active' : '')}>
            Mata kuliah
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
