import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '../api/client';

type Barber = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  active: boolean;
};

type Popup = {
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: string[];
};

export function BarbersPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState<Popup | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeBarbers = useMemo(() => {
    return barbers
      .filter((barber) => barber.active)
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }

        return a.name.localeCompare(b.name);
      });
  }, [barbers]);

  const inactiveBarbers = useMemo(() => {
    return barbers
      .filter((barber) => !barber.active)
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }

        return a.name.localeCompare(b.name);
      });
  }, [barbers]);

  async function load() {
    try {
      const result = await api<Barber[]>('/barbers/all');

      setBarbers(result);
      setError('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load barbers.',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    const code = String(
      formData.get('code') ?? '',
    )
      .trim()
      .toUpperCase();

    const name = String(
      formData.get('name') ?? '',
    ).trim();

    const displayOrder = Number(
      formData.get('displayOrder') || 0,
    );

    if (!code || !name) {
      setPopup({
        type: 'error',
        title: 'Unable to Add Barber',
        message:
          'Barber code and name are required.',
      });

      return;
    }

    try {
      setCreating(true);
      setError('');

      await api<Barber>('/barbers', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          displayOrder,
        }),
      });

      form.reset();

      await load();

      setPopup({
        type: 'success',
        title: 'Barber Added',
        message: `${name} was successfully added.`,
        details: [
          `Barber: ${name}`,
          `Code: ${code}`,
          `Display Order: ${displayOrder}`,
          'Status: Active',
        ],
      });
    } catch (e) {
      setPopup({
        type: 'error',
        title: 'Unable to Add Barber',
        message:
          e instanceof Error
            ? e.message
            : 'An unexpected error occurred.',
        details: [
          `Barber: ${name}`,
          `Code: ${code}`,
        ],
      });
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(barber: Barber) {
    const confirmed = window.confirm(
      `Deactivate ${barber.name}?\n\n` +
        'The barber will no longer appear in the cashier selection.',
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(barber.id);
      setError('');

      await api<Barber>(
        `/barbers/${barber.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            active: false,
          }),
        },
      );

      await load();

      setPopup({
        type: 'success',
        title: 'Barber Deactivated',
        message: `${barber.name} was successfully deactivated.`,
        details: [
          `Barber: ${barber.name}`,
          `Code: ${barber.code}`,
          'Status: Inactive',
        ],
      });
    } catch (e) {
      setPopup({
        type: 'error',
        title: 'Unable to Deactivate Barber',
        message:
          e instanceof Error
            ? e.message
            : 'An unexpected error occurred.',
        details: [
          `Barber: ${barber.name}`,
          `Code: ${barber.code}`,
        ],
      });
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(barber: Barber) {
    const confirmed = window.confirm(
      `Reactivate ${barber.name}?\n\n` +
        'The barber will appear again in the cashier selection.',
    );

    if (!confirmed) {
      return;
    }

    try {
      setBusyId(barber.id);
      setError('');

      await api<Barber>(
        `/barbers/${barber.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            active: true,
          }),
        },
      );

      await load();

      setPopup({
        type: 'success',
        title: 'Barber Reactivated',
        message: `${barber.name} was successfully reactivated.`,
        details: [
          `Barber: ${barber.name}`,
          `Code: ${barber.code}`,
          'Status: Active',
        ],
      });
    } catch (e) {
      setPopup({
        type: 'error',
        title: 'Unable to Reactivate Barber',
        message:
          e instanceof Error
            ? e.message
            : 'An unexpected error occurred.',
        details: [
          `Barber: ${barber.name}`,
          `Code: ${barber.code}`,
        ],
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Barber Management</h1>

          <p>
            Manage active and inactive barbers
            available for service transactions.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <div className="card-estylo mb-4">
        <h5 className="mb-3">
          Add Barber
        </h5>

        <form
          className="row g-2"
          onSubmit={create}
        >
          <div className="col-md-3">
            <label className="form-label">
              Barber Code
            </label>

            <input
              type="text"
              name="code"
              className="form-control"
              placeholder="e.g. CARLO"
              autoComplete="off"
              required
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">
              Barber Name
            </label>

            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="Barber name"
              autoComplete="off"
              required
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">
              Display Order
            </label>

            <input
              type="number"
              name="displayOrder"
              className="form-control"
              min="0"
              defaultValue="0"
            />
          </div>

          <div className="col-md-3 d-flex align-items-end">
            <button
              type="submit"
              className="btn btn-estylo w-100"
              disabled={creating}
            >
              {creating
                ? 'ADDING...'
                : 'ADD BARBER'}
            </button>
          </div>
        </form>
      </div>

      <div className="card-estylo table-wrap mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="mb-1">
              Active Barbers
            </h5>

            <small className="text-muted">
              Barbers currently available in the
              cashier page.
            </small>
          </div>

          <span className="badge bg-success">
            {activeBarbers.length} Active
          </span>
        </div>

        <table className="table align-middle">
          <thead>
            <tr>
              <th>Display Order</th>
              <th>Code</th>
              <th>Barber</th>
              <th>Status</th>
              <th className="text-end">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {activeBarbers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-muted py-4"
                >
                  No active barbers.
                </td>
              </tr>
            ) : (
              activeBarbers.map((barber) => (
                <tr key={barber.id}>
                  <td>
                    {barber.displayOrder}
                  </td>

                  <td>
                    <strong>
                      {barber.code}
                    </strong>
                  </td>

                  <td>
                    {barber.name}
                  </td>

                  <td>
                    <span className="badge bg-success">
                      Active
                    </span>
                  </td>

                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={
                        busyId === barber.id
                      }
                      onClick={() =>
                        void deactivate(barber)
                      }
                    >
                      {busyId === barber.id
                        ? 'Processing...'
                        : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card-estylo table-wrap">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="mb-1">
              Inactive Barbers
            </h5>

            <small className="text-muted">
              Disabled barbers are hidden from
              the cashier page.
            </small>
          </div>

          <span className="badge bg-secondary">
            {inactiveBarbers.length} Inactive
          </span>
        </div>

        <table className="table align-middle">
          <thead>
            <tr>
              <th>Display Order</th>
              <th>Code</th>
              <th>Barber</th>
              <th>Status</th>
              <th className="text-end">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {inactiveBarbers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-muted py-4"
                >
                  No inactive barbers.
                </td>
              </tr>
            ) : (
              inactiveBarbers.map((barber) => (
                <tr key={barber.id}>
                  <td>
                    {barber.displayOrder}
                  </td>

                  <td>
                    <strong>
                      {barber.code}
                    </strong>
                  </td>

                  <td>
                    {barber.name}
                  </td>

                  <td>
                    <span className="badge bg-secondary">
                      Inactive
                    </span>
                  </td>

                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      disabled={
                        busyId === barber.id
                      }
                      onClick={() =>
                        void reactivate(barber)
                      }
                    >
                      {busyId === barber.id
                        ? 'Processing...'
                        : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {popup && (
        <div
          className="
            position-fixed
            top-0
            start-0
            w-100
            h-100
            d-flex
            align-items-center
            justify-content-center
          "
          style={{
            backgroundColor:
              'rgba(0,0,0,0.55)',
            zIndex: 9999,
            padding: '20px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card shadow-lg"
            style={{
              width: '100%',
              maxWidth: '460px',
              borderRadius: '14px',
            }}
          >
            <div className="card-body p-4 text-center">
              <div
                className={
                  popup.type === 'success'
                    ? 'text-success'
                    : 'text-danger'
                }
                style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {popup.type === 'success'
                  ? '✓'
                  : '!'}
              </div>

              <h4 className="mt-3 mb-2">
                {popup.title}
              </h4>

              <p className="text-muted">
                {popup.message}
              </p>

              {popup.details &&
                popup.details.length > 0 && (
                  <div
                    className="
                      bg-light
                      rounded
                      p-3
                      text-start
                      mb-3
                    "
                    style={{
                      fontSize: '0.9rem',
                    }}
                  >
                    {popup.details.map(
                      (detail, index) => (
                        <div key={index}>
                          {detail}
                        </div>
                      ),
                    )}
                  </div>
                )}

              <button
                type="button"
                className={
                  popup.type === 'success'
                    ? 'btn btn-estylo px-5'
                    : 'btn btn-danger px-5'
                }
                onClick={() =>
                  setPopup(null)
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}