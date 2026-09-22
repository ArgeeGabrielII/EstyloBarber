import { useEffect, useMemo, useState } from 'react';
import { api, money } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type Barber = {
  id: string;
  name: string;
};

type Seat = {
  id: string;
  name: string;
  number: number;
};

type Service = {
  id: string;
  name: string;
  fee: string;
};

type Product = {
  id: string;
  name: string;
  sellingPrice: string;
  quantityOnHand: string;
  unit: string;
};

type Line<T> = {
  data: T;
  qty: number;
};

type CheckoutResult = {
  totalCollected: string;
  serviceTransaction?: {
    transactionId: string;
    amount: string;
    tip: string;
  };
  itemTransaction?: {
    transactionId: string;
    amount: string;
  };
};

export function CashierPage() {
  const { user, logout } = useAuth();

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [barberId, setBarberId] = useState('');
  const [seatId, setSeatId] = useState('');

  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const [svc, setSvc] = useState<Record<string, Line<Service>>>({});
  const [items, setItems] = useState<Record<string, Line<Product>>>({});

  const [tip, setTip] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    Promise.all([
      api<Barber[]>('/barbers'),
      api<Seat[]>('/seats'),
      api<Service[]>('/services'),
      api<Product[]>('/inventory/retail'),
    ])
      .then(([barberData, seatData, serviceData, productData]) => {
        setBarbers(barberData);
        setSeats(seatData);
        setServices(serviceData);
        setProducts(productData);
      })
      .catch((e: Error) => {
        setError(e.message);
      });
  }, []);

  const serviceTotal = useMemo(
    () =>
      Object.values(svc).reduce(
        (total, line) => total + Number(line.data.fee) * line.qty,
        0,
      ),
    [svc],
  );

  const itemTotal = useMemo(
    () =>
      Object.values(items).reduce(
        (total, line) =>
          total + Number(line.data.sellingPrice) * line.qty,
        0,
      ),
    [items],
  );

  const grand = serviceTotal + itemTotal + (Number(tip) || 0);

  const addSvc = (service: Service) => {
    setSvc((current) => ({
      ...current,
      [service.id]: {
        data: service,
        qty: (current[service.id]?.qty ?? 0) + 1,
      },
    }));
  };

  const addItem = (product: Product) => {
    setItems((current) => ({
      ...current,
      [product.id]: {
        data: product,
        qty: (current[product.id]?.qty ?? 0) + 1,
      },
    }));
  };

  const change = (
    kind: 'svc' | 'item',
    id: string,
    delta: number,
  ) => {
    const setter = kind === 'svc' ? setSvc : setItems;

    setter((current: any) => {
      const newQuantity = (current[id]?.qty ?? 0) + delta;
      const updated = { ...current };

      if (newQuantity <= 0) {
        delete updated[id];
      } else {
        updated[id] = {
          ...current[id],
          qty: newQuantity,
        };
      }

      return updated;
    });
  };

  /**
   * Clears the active transaction.
   *
   * Includes:
   * - barber
   * - seat
   * - services
   * - products
   * - quantities
   * - tip
   * - errors
   */
  const resetTransaction = () => {
    setBarberId('');
    setSeatId('');

    setSvc({});
    setItems({});

    setTip('0');
    setError('');

    setIdempotencyKey(crypto.randomUUID());
  };

  /**
   * CLEAR button
   *
   * Also dismisses any previous completed-sale dialog.
   */
  const clear = () => {
    resetTransaction();
    setDone(null);
  };

  async function complete() {
    setError('');

    const hasServices = Object.keys(svc).length > 0;

    if (hasServices && !barberId) {
      setError('Select a barber for the service.');
      return;
    }

    if (hasServices && !seatId) {
      setError('Select a seat for the service.');
      return;
    }

    setBusy(true);

    try {
      const result = await api<CheckoutResult>('/checkouts', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,

          barberId: barberId || undefined,
          seatId: seatId || undefined,

          services: Object.values(svc).map((line) => ({
            serviceId: line.data.id,
            quantity: line.qty,
          })),

          items: Object.values(items).map((line) => ({
            inventoryItemId: line.data.id,
            quantity: String(line.qty),
          })),

          tip: String(Number(tip) || 0),
        }),
      });

      /*
       * Keep the completed-sale overlay visible,
       * but reset everything behind it.
       */
      setDone(result);
      resetTransaction();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Checkout failed',
      );
    } finally {
      setBusy(false);
    }
  }

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="pos">
      {/* HEADER */}
      <header className="pos-header">
        <div className="pos-brand">
          <img
            src="/estylo-logo.jpg"
            alt="Estylo Barbers"
          />

          <div>
            <b>ESTYLO CASHIER</b>
            <small>Touch POS</small>
          </div>
        </div>

        <div className="pos-user">
          <strong>{user?.displayName}</strong>

          <small>
            Cashier ·{' '}
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-secondary"
              onClick={handleLogout}
            >
              Logout
            </button>
          </small>
        </div>
      </header>

      <div className="pos-grid">
        {/* LEFT PANEL */}
        <section className="pos-left">
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {/* BARBER */}
          <div className="section-label">
            SELECT BARBER
          </div>

          <div className="choice-grid">
            {barbers.map((barber) => {
              const selected =
                barberId === barber.id;

              return (
                <button
                  type="button"
                  key={barber.id}
                  className={`choice-btn ${
                    selected ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setBarberId(barber.id)
                  }
                >
                  {barber.name}

                  <small>
                    {selected
                      ? 'Selected'
                      : 'Tap to select'}
                  </small>
                </button>
              );
            })}
          </div>

          {/* SEAT */}
          <div className="section-label">
            SELECT SEAT
          </div>

          <div className="choice-grid">
            {seats.map((seat) => {
              const selected =
                seatId === seat.id;

              return (
                <button
                  type="button"
                  key={seat.id}
                  className={`choice-btn ${
                    selected ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setSeatId(seat.id)
                  }
                >
                  {seat.name}

                  <small>
                    Station {seat.number}
                    {selected ? ' · Selected' : ''}
                  </small>
                </button>
              );
            })}
          </div>

          {/* SERVICES */}
          <div className="section-label">
            SELECT SERVICE
          </div>

          <div className="service-grid mb-4">
            {services.map((service) => (
              <button
                type="button"
                className="tile"
                key={service.id}
                onClick={() => addSvc(service)}
              >
                <strong>
                  {service.name}
                </strong>

                <span>
                  {money(service.fee)}
                </span>
              </button>
            ))}
          </div>

          {/* PRODUCTS */}
          <div className="section-label">
            PRODUCTS
          </div>

          <div className="product-grid">
            {products.map((product) => (
              <button
                type="button"
                className="tile"
                key={product.id}
                onClick={() =>
                  addItem(product)
                }
              >
                <strong>
                  {product.name}
                </strong>

                <small>
                  {product.quantityOnHand}{' '}
                  {product.unit} available
                </small>

                <span>
                  {money(
                    product.sellingPrice,
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <aside className="pos-right">
          <div className="section-label">
            CURRENT SALE
          </div>

          {/* CURRENT BARBER / SEAT */}
          {(barberId || seatId) && (
            <div className="mb-3">
              {barberId && (
                <small className="d-block">
                  Barber:{' '}
                  <strong>
                    {
                      barbers.find(
                        (barber) =>
                          barber.id ===
                          barberId,
                      )?.name
                    }
                  </strong>
                </small>
              )}

              {seatId && (
                <small className="d-block">
                  Seat:{' '}
                  <strong>
                    {
                      seats.find(
                        (seat) =>
                          seat.id ===
                          seatId,
                      )?.name
                    }
                  </strong>
                </small>
              )}
            </div>
          )}

          <div className="sale-lines">
            {!Object.keys(svc).length &&
              !Object.keys(items).length && (
                <div className="empty">
                  Select a service or
                  product.
                </div>
              )}

            {/* SERVICES */}
            {Object.entries(svc).map(
              ([id, line]) => (
                <div
                  className="sale-line"
                  key={id}
                >
                  <div>
                    <strong>
                      {line.data.name}
                    </strong>

                    <small>
                      {money(line.data.fee)} ×{' '}
                      {line.qty}
                    </small>
                  </div>

                  <div className="line-actions">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() =>
                        change(
                          'svc',
                          id,
                          -1,
                        )
                      }
                    >
                      −
                    </button>

                    <b>{line.qty}</b>

                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() =>
                        change(
                          'svc',
                          id,
                          1,
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ),
            )}

            {/* PRODUCTS */}
            {Object.entries(items).map(
              ([id, line]) => (
                <div
                  className="sale-line"
                  key={id}
                >
                  <div>
                    <strong>
                      {line.data.name}
                    </strong>

                    <small>
                      {money(
                        line.data
                          .sellingPrice,
                      )}{' '}
                      × {line.qty}
                    </small>
                  </div>

                  <div className="line-actions">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() =>
                        change(
                          'item',
                          id,
                          -1,
                        )
                      }
                    >
                      −
                    </button>

                    <b>{line.qty}</b>

                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() =>
                        change(
                          'item',
                          id,
                          1,
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>

          {/* TOTALS */}
          <div className="totals">
            <div className="total-row">
              <span>Service</span>
              <b>{money(serviceTotal)}</b>
            </div>

            <div className="total-row">
              <span>Items</span>
              <b>{money(itemTotal)}</b>
            </div>

            <div className="total-row align-items-center">
              <span>Tip</span>

              <input
                className="tip-input"
                inputMode="decimal"
                value={tip}
                onChange={(e) =>
                  setTip(e.target.value)
                }
              />
            </div>

            <div className="total-row grand-total">
              <span>TOTAL</span>
              <span>{money(grand)}</span>
            </div>
          </div>

          {/* ACTIONS */}
          <button
            type="button"
            className="btn btn-estylo complete-btn"
            disabled={
              busy || grand <= 0
            }
            onClick={complete}
          >
            {busy
              ? 'PROCESSING…'
              : 'COMPLETE SALE'}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary clear-btn"
            disabled={busy}
            onClick={clear}
          >
            CLEAR
          </button>
        </aside>
      </div>

      {/* SUCCESS DIALOG */}
      {done && (
        <div className="success-overlay">
          <div className="success-card">
            <div className="check">
              ✓
            </div>

            <h2>SALE COMPLETED</h2>

            {done.serviceTransaction && (
              <p>
                <b>
                  {
                    done
                      .serviceTransaction
                      .transactionId
                  }
                </b>

                <br />

                Service{' '}
                {money(
                  done
                    .serviceTransaction
                    .amount,
                )}{' '}
                · Tip{' '}
                {money(
                  done
                    .serviceTransaction
                    .tip,
                )}
              </p>
            )}

            {done.itemTransaction && (
              <p>
                <b>
                  {
                    done
                      .itemTransaction
                      .transactionId
                  }
                </b>

                <br />

                Items{' '}
                {money(
                  done.itemTransaction
                    .amount,
                )}
              </p>
            )}

            <h3>
              {money(
                done.totalCollected,
              )}
            </h3>

            <button
              type="button"
              className="btn btn-estylo mt-3 px-5 py-2"
              onClick={() =>
                setDone(null)
              }
            >
              NEW TRANSACTION
            </button>
          </div>
        </div>
      )}
    </div>
  );
}