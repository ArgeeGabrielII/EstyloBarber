import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  api,
  money,
} from '../api/client';

import {
  useAuth,
} from '../auth/AuthContext';

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
  const {
    user,
    logout,
  } =
    useAuth();

  const [
    barbers,
    setBarbers,
  ] =
    useState<
      Barber[]
    >([]);

  const [
    seats,
    setSeats,
  ] =
    useState<
      Seat[]
    >([]);

  const [
    services,
    setServices,
  ] =
    useState<
      Service[]
    >([]);

  const [
    products,
    setProducts,
  ] =
    useState<
      Product[]
    >([]);

  const [
    barberId,
    setBarberId,
  ] =
    useState('');

  const [
    seatId,
    setSeatId,
  ] =
    useState('');

  const [
    idempotencyKey,
    setIdempotencyKey,
  ] =
    useState(
      () =>
        crypto.randomUUID(),
    );

  const [
    svc,
    setSvc,
  ] =
    useState<
      Record<
        string,
        Line<Service>
      >
    >({});

  const [
    items,
    setItems,
  ] =
    useState<
      Record<
        string,
        Line<Product>
      >
    >({});

  const [
    tip,
    setTip,
  ] =
    useState('0');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    done,
    setDone,
  ] =
    useState<
      CheckoutResult | null
    >(null);

  const [
    confirmOpen,
    setConfirmOpen,
  ] =
    useState(false);

  useEffect(() => {
    Promise.all([
      api<Barber[]>(
        '/barbers',
      ),

      api<Seat[]>(
        '/seats',
      ),

      api<Service[]>(
        '/services',
      ),

      api<Product[]>(
        '/inventory/retail',
      ),
    ])
      .then(
        ([
          barberData,
          seatData,
          serviceData,
          productData,
        ]) => {
          setBarbers(
            barberData,
          );

          setSeats(
            seatData,
          );

          setServices(
            serviceData,
          );

          setProducts(
            productData,
          );
        },
      )
      .catch(
        (
          e: Error,
        ) => {
          setError(
            e.message,
          );
        },
      );
  }, []);

  const selectedBarber =
    useMemo(
      () =>
        barbers.find(
          (
            barber,
          ) =>
            barber.id ===
            barberId,
        ),
      [
        barbers,
        barberId,
      ],
    );

  const selectedSeat =
    useMemo(
      () =>
        seats.find(
          (
            seat,
          ) =>
            seat.id ===
            seatId,
        ),
      [
        seats,
        seatId,
      ],
    );

  const serviceTotal =
    useMemo(
      () =>
        Object.values(
          svc,
        ).reduce(
          (
            total,
            line,
          ) =>
            total +
            Number(
              line.data
                .fee,
            ) *
              line.qty,

          0,
        ),

      [
        svc,
      ],
    );

  const itemTotal =
    useMemo(
      () =>
        Object.values(
          items,
        ).reduce(
          (
            total,
            line,
          ) =>
            total +
            Number(
              line.data
                .sellingPrice,
            ) *
              line.qty,

          0,
        ),

      [
        items,
      ],
    );

  const tipAmount =
    Number(
      tip,
    ) || 0;

  const grand =
    serviceTotal +
    itemTotal +
    tipAmount;

  const addSvc = (
    service: Service,
  ) => {
    setSvc(
      (
        current,
      ) => ({
        ...current,

        [service.id]: {
          data:
            service,

          qty:
            (
              current[
                service.id
              ]?.qty ??
              0
            ) + 1,
        },
      }),
    );
  };

  const addItem = (
    product: Product,
  ) => {
    setItems(
      (
        current,
      ) => ({
        ...current,

        [product.id]: {
          data:
            product,

          qty:
            (
              current[
                product.id
              ]?.qty ??
              0
            ) + 1,
        },
      }),
    );
  };

  const change = (
    kind:
      | 'svc'
      | 'item',

    id: string,

    delta: number,
  ) => {
    if (
      kind ===
      'svc'
    ) {
      setSvc(
        (
          current,
        ) => {
          const newQuantity =
            (
              current[
                id
              ]?.qty ??
              0
            ) +
            delta;

          const updated = {
            ...current,
          };

          if (
            newQuantity <=
            0
          ) {
            delete updated[
              id
            ];
          } else {
            updated[id] = {
              ...current[
                id
              ],

              qty:
                newQuantity,
            };
          }

          return updated;
        },
      );

      return;
    }

    setItems(
      (
        current,
      ) => {
        const newQuantity =
          (
            current[
              id
            ]?.qty ??
              0
          ) +
          delta;

        const updated = {
          ...current,
        };

        if (
          newQuantity <=
          0
        ) {
          delete updated[
            id
          ];
        } else {
          updated[id] = {
            ...current[
              id
            ],

            qty:
              newQuantity,
          };
        }

        return updated;
      },
    );
  };

  const resetTransaction =
    () => {
      setBarberId(
        '',
      );

      setSeatId(
        '',
      );

      setSvc(
        {},
      );

      setItems(
        {},
      );

      setTip(
        '0',
      );

      setError(
        '',
      );

      setConfirmOpen(
        false,
      );

      setIdempotencyKey(
        crypto.randomUUID(),
      );
    };

  const clear =
    () => {
      resetTransaction();

      setDone(
        null,
      );
    };

  /*
   * COMPLETE SALE BUTTON
   *
   * Does NOT save yet.
   * It first validates the transaction,
   * then opens the confirmation dialog.
   */
  function requestConfirmation() {
    setError(
      '',
    );

    const hasServices =
      Object.keys(
        svc,
      ).length >
      0;

    const hasItems =
      Object.keys(
        items,
      ).length >
      0;

    if (
      !hasServices &&
      !hasItems
    ) {
      setError(
        'Select at least one service or product.',
      );

      return;
    }

    if (
      hasServices &&
      !barberId
    ) {
      setError(
        'Select a barber for the service.',
      );

      return;
    }

    if (
      hasServices &&
      !seatId
    ) {
      setError(
        'Select a seat for the service.',
      );

      return;
    }

    if (
      tipAmount <
      0
    ) {
      setError(
        'Tip cannot be negative.',
      );

      return;
    }

    setConfirmOpen(
      true,
    );
  }

  /*
   * CONFIRM SALE
   *
   * This is the actual save operation.
   */
  async function confirmSale() {
    setError(
      '',
    );

    setBusy(
      true,
    );

    try {
      const result =
        await api<CheckoutResult>(
          '/checkouts',
          {
            method:
              'POST',

            body:
              JSON.stringify(
                {
                  idempotencyKey,

                  barberId:
                    barberId ||
                    undefined,

                  seatId:
                    seatId ||
                    undefined,

                  services:
                    Object.values(
                      svc,
                    ).map(
                      (
                        line,
                      ) => ({
                        serviceId:
                          line
                            .data
                            .id,

                        quantity:
                          line.qty,
                      }),
                    ),

                  items:
                    Object.values(
                      items,
                    ).map(
                      (
                        line,
                      ) => ({
                        inventoryItemId:
                          line
                            .data
                            .id,

                        quantity:
                          String(
                            line.qty,
                          ),
                      }),
                    ),

                  tip:
                    String(
                      tipAmount,
                    ),
                },
              ),
          },
        );

      setConfirmOpen(
        false,
      );

      setDone(
        result,
      );

      resetTransaction();
    } catch (e) {
      setConfirmOpen(
        false,
      );

      setError(
        e instanceof
          Error
          ? e.message
          : 'Checkout failed.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  const handleLogout =
    async () => {
      await logout();

      window.location.href =
        '/login';
    };

  return (
    <div className="pos">
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="pos-header">
        <div className="pos-brand">
          <img
            src="/estylo-logo.jpg"
            alt="Estylo Barbers"
          />

          <div>
            <b>
              ESTYLO CASHIER
            </b>

            <small>
              Touch POS
            </small>
          </div>
        </div>

        <div className="pos-user">
          <strong>
            {
              user?.displayName
            }
          </strong>

          <small>
            Cashier ·{' '}
            <button
              type="button"
              className="btn btn-estylo btn-sm"
              onClick={() => {
                window.location.href = '/transactions';
              }}
            >
              <i className="bi bi-receipt me-1"></i>
              Transactions
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-secondary"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>
          </small>
        </div>
      </header>

      <div className="pos-grid">
        {/* ==================================================
            LEFT
        ================================================== */}

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
            {barbers.map(
              (
                barber,
              ) => {
                const selected =
                  barberId ===
                  barber.id;

                return (
                  <button
                    type="button"
                    key={
                      barber.id
                    }
                    className={`choice-btn ${
                      selected
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setBarberId(
                        barber.id,
                      )
                    }
                  >
                    {
                      barber.name
                    }

                    <small>
                      {selected
                        ? 'Selected'
                        : 'Tap to select'}
                    </small>
                  </button>
                );
              },
            )}
          </div>

          {/* SEAT */}

          <div className="section-label">
            SELECT SEAT
          </div>

          <div className="choice-grid">
            {seats.map(
              (
                seat,
              ) => {
                const selected =
                  seatId ===
                  seat.id;

                return (
                  <button
                    type="button"
                    key={
                      seat.id
                    }
                    className={`choice-btn ${
                      selected
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      setSeatId(
                        seat.id,
                      )
                    }
                  >
                    {
                      seat.name
                    }

                    <small>
                      Station{' '}
                      {
                        seat.number
                      }

                      {selected
                        ? ' · Selected'
                        : ''}
                    </small>
                  </button>
                );
              },
            )}
          </div>

          {/* SERVICES */}

          <div className="section-label">
            SELECT SERVICE
          </div>

          <div className="service-grid mb-4">
            {services.map(
              (
                service,
              ) => (
                <button
                  type="button"
                  className="tile"
                  key={
                    service.id
                  }
                  onClick={() =>
                    addSvc(
                      service,
                    )
                  }
                >
                  <strong>
                    {
                      service.name
                    }
                  </strong>

                  <span>
                    {money(
                      service.fee,
                    )}
                  </span>
                </button>
              ),
            )}
          </div>

          {/* PRODUCTS */}

          <div className="section-label">
            PRODUCTS
          </div>

          <div className="product-grid">
            {products.map(
              (
                product,
              ) => (
                <button
                  type="button"
                  className="tile"
                  key={
                    product.id
                  }
                  onClick={() =>
                    addItem(
                      product,
                    )
                  }
                >
                  <strong>
                    {
                      product.name
                    }
                  </strong>

                  <small>
                    {
                      product.quantityOnHand
                    }{' '}
                    {
                      product.unit
                    }{' '}
                    available
                  </small>

                  <span>
                    {money(
                      product.sellingPrice,
                    )}
                  </span>
                </button>
              ),
            )}
          </div>
        </section>

        {/* ==================================================
            RIGHT
        ================================================== */}

        <aside className="pos-right">
          <div className="section-label">
            CURRENT SALE
          </div>

          {(selectedBarber ||
            selectedSeat) && (
            <div className="mb-3">
              {selectedBarber && (
                <small className="d-block">
                  Barber:{' '}

                  <strong>
                    {
                      selectedBarber.name
                    }
                  </strong>
                </small>
              )}

              {selectedSeat && (
                <small className="d-block">
                  Seat:{' '}

                  <strong>
                    {
                      selectedSeat.name
                    }
                  </strong>
                </small>
              )}
            </div>
          )}

          <div className="sale-lines">
            {!Object.keys(
              svc,
            ).length &&
              !Object.keys(
                items,
              ).length && (
                <div className="empty">
                  Select a
                  service or
                  product.
                </div>
              )}

            {/* SERVICE LINES */}

            {Object.entries(
              svc,
            ).map(
              ([
                id,
                line,
              ]) => (
                <div
                  className="sale-line"
                  key={
                    id
                  }
                >
                  <div>
                    <strong>
                      {
                        line
                          .data
                          .name
                      }
                    </strong>

                    <small>
                      {money(
                        line
                          .data
                          .fee,
                      )}{' '}
                      ×{' '}
                      {
                        line.qty
                      }
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

                    <b>
                      {
                        line.qty
                      }
                    </b>

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

            {/* PRODUCT LINES */}

            {Object.entries(
              items,
            ).map(
              ([
                id,
                line,
              ]) => (
                <div
                  className="sale-line"
                  key={
                    id
                  }
                >
                  <div>
                    <strong>
                      {
                        line
                          .data
                          .name
                      }
                    </strong>

                    <small>
                      {money(
                        line
                          .data
                          .sellingPrice,
                      )}{' '}
                      ×{' '}
                      {
                        line.qty
                      }
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

                    <b>
                      {
                        line.qty
                      }
                    </b>

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
              <span>
                Service
              </span>

              <b>
                {money(
                  serviceTotal,
                )}
              </b>
            </div>

            <div className="total-row">
              <span>
                Items
              </span>

              <b>
                {money(
                  itemTotal,
                )}
              </b>
            </div>

            <div className="total-row align-items-center">
              <span>
                Tip
              </span>

              <input
                className="tip-input"
                inputMode="decimal"
                value={
                  tip
                }
                onChange={(
                  e,
                ) =>
                  setTip(
                    e.target
                      .value,
                  )
                }
              />
            </div>

            <div className="total-row grand-total">
              <span>
                TOTAL
              </span>

              <span>
                {money(
                  grand,
                )}
              </span>
            </div>
          </div>

          {/* ACTIONS */}

          <button
            type="button"
            className="btn btn-estylo complete-btn"
            disabled={
              busy ||
              grand <=
                0
            }
            onClick={
              requestConfirmation
            }
          >
            COMPLETE SALE
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary clear-btn"
            disabled={
              busy
            }
            onClick={
              clear
            }
          >
            CLEAR
          </button>
        </aside>
      </div>

      {/* ==================================================
          CONFIRMATION DIALOG
      ================================================== */}

      {confirmOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor:
              'rgba(0,0,0,0.65)',

            zIndex:
              9999,

            padding:
              '20px',
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="card shadow-lg"
            style={{
              width:
                '100%',

              maxWidth:
                '560px',

              maxHeight:
                '90vh',

              overflowY:
                'auto',

              borderRadius:
                '16px',
            }}
          >
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div
                  style={{
                    fontSize:
                      '2.5rem',

                    lineHeight:
                      1,
                  }}
                >
                  ?
                </div>

                <h3 className="mt-3 mb-1">
                  Confirm Sale
                </h3>

                <p className="text-muted mb-0">
                  Please review
                  the transaction
                  before saving.
                </p>
              </div>

              {/* BARBER / SEAT */}

              {Object.keys(
                svc,
              ).length >
                0 && (
                <div className="bg-light rounded p-3 mb-3">
                  <div className="row">
                    <div className="col-6">
                      <small className="text-muted d-block">
                        Barber
                      </small>

                      <strong>
                        {
                          selectedBarber
                            ?.name
                        }
                      </strong>
                    </div>

                    <div className="col-6">
                      <small className="text-muted d-block">
                        Seat
                      </small>

                      <strong>
                        {
                          selectedSeat
                            ?.name
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SERVICES */}

              {Object.values(
                svc,
              ).length >
                0 && (
                <div className="mb-4">
                  <h6>
                    Services
                  </h6>

                  {Object.values(
                    svc,
                  ).map(
                    (
                      line,
                    ) => (
                      <div
                        key={
                          line
                            .data
                            .id
                        }
                        className="d-flex justify-content-between border-bottom py-2"
                      >
                        <div>
                          <strong>
                            {
                              line
                                .data
                                .name
                            }
                          </strong>

                          <div className="small text-muted">
                            {
                              line.qty
                            }{' '}
                            ×{' '}
                            {money(
                              line
                                .data
                                .fee,
                            )}
                          </div>
                        </div>

                        <strong>
                          {money(
                            Number(
                              line
                                .data
                                .fee,
                            ) *
                              line.qty,
                          )}
                        </strong>
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* PRODUCTS */}

              {Object.values(
                items,
              ).length >
                0 && (
                <div className="mb-4">
                  <h6>
                    Products
                  </h6>

                  {Object.values(
                    items,
                  ).map(
                    (
                      line,
                    ) => (
                      <div
                        key={
                          line
                            .data
                            .id
                        }
                        className="d-flex justify-content-between border-bottom py-2"
                      >
                        <div>
                          <strong>
                            {
                              line
                                .data
                                .name
                            }
                          </strong>

                          <div className="small text-muted">
                            {
                              line.qty
                            }{' '}
                            ×{' '}
                            {money(
                              line
                                .data
                                .sellingPrice,
                            )}
                          </div>
                        </div>

                        <strong>
                          {money(
                            Number(
                              line
                                .data
                                .sellingPrice,
                            ) *
                              line.qty,
                          )}
                        </strong>
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* CONFIRM TOTALS */}

              <div className="bg-light rounded p-3 mb-4">
                <div className="d-flex justify-content-between mb-2">
                  <span>
                    Service
                  </span>

                  <strong>
                    {money(
                      serviceTotal,
                    )}
                  </strong>
                </div>

                <div className="d-flex justify-content-between mb-2">
                  <span>
                    Products
                  </span>

                  <strong>
                    {money(
                      itemTotal,
                    )}
                  </strong>
                </div>

                <div className="d-flex justify-content-between mb-2">
                  <span>
                    Tip
                  </span>

                  <strong>
                    {money(
                      tipAmount,
                    )}
                  </strong>
                </div>

                <hr />

                <div className="d-flex justify-content-between">
                  <strong>
                    TOTAL
                  </strong>

                  <strong
                    style={{
                      fontSize:
                        '1.4rem',
                    }}
                  >
                    {money(
                      grand,
                    )}
                  </strong>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    setConfirmOpen(
                      false,
                    )
                  }
                >
                  CANCEL
                </button>

                <button
                  type="button"
                  className="btn btn-estylo flex-fill"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    void confirmSale()
                  }
                >
                  {busy
                    ? 'SAVING...'
                    : 'CONFIRM SALE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          SUCCESS DIALOG
      ================================================== */}

      {done && (
        <div className="success-overlay">
          <div className="success-card">
            <div className="check">
              ✓
            </div>

            <h2>
              SALE COMPLETED
            </h2>

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
                  done
                    .itemTransaction
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
                setDone(
                  null,
                )
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