import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const link = (to: string, label: string, icon: string) => (
  <NavLink
    to={to}
    className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
  >
    <i className={`bi ${icon}`}></i>
    <span>{label}</span>
  </NavLink>
);

export function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/estylo-logo.jpg" alt="Estylo Barbers" />

          <div>
            <b>ESTYLO</b>
            <small>BARBERS</small>
          </div>
        </div>

        <nav>
          {user?.role === 'ADMIN' && (
            <>
              {link('/dashboard', 'Dashboard', 'bi-grid-1x2-fill')}

              <div className="nav-section">SALES</div>
              {link('/cashier', 'Cashier', 'bi-calculator')}
              {link('/transactions', 'Transactions', 'bi-receipt')}

              <div className="nav-section">INVENTORY</div>
              {link('/inventory', 'Inventory', 'bi-box-seam')}

              <div className="nav-section">REPORTS</div>
              {link('/reports', 'Reports', 'bi-bar-chart-fill')}

              <div className="nav-section">MAINTENANCE</div>
              {link('/maintenance/services', 'Services', 'bi-scissors')}
              {link('/maintenance/barbers', 'Barbers', 'bi-person-badge')}
              {link('/maintenance/users', 'Users', 'bi-people-fill')}
              {link('/maintenance/audit', 'Audit Log', 'bi-clock-history')}
            </>
          )}

          {user?.role === 'CASHIER' && (
            <>
              <div className="nav-section">SALES</div>
              {link('/cashier', 'Cashier', 'bi-calculator')}
              {link('/transactions', 'Transactions', 'bi-receipt')}
            </>
          )}

          {user?.role === 'VIEWER' &&
            link('/reports', 'Reports', 'bi-bar-chart-fill')}
        </nav>

        <button
          type="button"
          className="logout"
          onClick={async () => {
            await logout();
            nav('/login');
          }}
        >
          <i className="bi bi-box-arrow-left"></i>
          Logout
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <strong>{user?.displayName}</strong>
            <small>{user?.role}</small>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
