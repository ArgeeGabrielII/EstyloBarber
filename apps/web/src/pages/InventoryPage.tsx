import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  ApiError,
  api,
  money,
} from '../api/client';

type Item = {
  id: string;
  sku: string;
  name: string;
  type: string;
  unit: string;

  quantityOnHand: string;
  warningLevel: string;
  reorderLevel: string;

  sellingPrice: string | null;

  active: boolean;
  stockStatus: string;
};

type Popup = {
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: string[];
};

export function InventoryPage() {
  const [items, setItems] =
    useState<Item[]>([]);

  const [error, setError] =
    useState('');

  const [popup, setPopup] =
    useState<Popup | null>(null);

  async function load() {
    try {
      const result =
        await api<Item[]>('/inventory');

      setItems(result);
      setError('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to load inventory',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /*
   * ------------------------------------------------
   * CREATE INVENTORY ITEM
   * ------------------------------------------------
   */
  async function create(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    /*
     * IMPORTANT:
     * Save the form reference BEFORE await.
     *
     * React's e.currentTarget may be null after
     * the async operation completes.
     */
    const form = e.currentTarget;

    const f = new FormData(form);

    const sku = String(
      f.get('sku'),
    ).toUpperCase();

    const name = String(
      f.get('name'),
    );

    try {
      setError('');

      await api<Item>('/inventory', {
        method: 'POST',

        body: JSON.stringify({
          sku,

          name,

          type: String(
            f.get('type'),
          ),

          unit: String(
            f.get('unit'),
          ),

          quantityOnHand: String(
            f.get('quantityOnHand'),
          ),

          warningLevel: String(
            f.get('warningLevel'),
          ),

          reorderLevel: String(
            f.get('reorderLevel'),
          ),

          sellingPrice:
            f.get('sellingPrice')
              ? String(
                  f.get(
                    'sellingPrice',
                  ),
                )
              : undefined,
        }),
      });

      /*
       * Safe because we stored the form
       * reference before await.
       */
      form.reset();

      await load();

      setPopup({
        type: 'success',

        title:
          'Inventory Item Added',

        message: `${name} was successfully added to inventory.`,

        details: [
          `SKU: ${sku}`,
        ],
      });
    } catch (e) {
      showFailure(
        e,
        'Unable to Add Inventory Item',
        [
          `Item: ${name}`,
          `SKU: ${sku}`,
        ],
      );
    }
  }

  /*
   * ------------------------------------------------
   * STOCK IN / MANUAL ADJUSTMENT
   * ------------------------------------------------
   */
  async function move(
  e: FormEvent<HTMLFormElement>,
  item: Item,
  kind: 'stock-in' | 'adjust',
) {
  e.preventDefault();

  // Save this BEFORE await.
  const form = e.currentTarget;

  const data = new FormData(form);

  const quantity = String(data.get('quantity'));
  const reason = String(data.get('reason'));

  try {
    setError('');

    const result = await api<Item>(
      `/inventory/${item.id}/${kind}`,
      {
        method: 'POST',
        body: JSON.stringify({
          quantity,
          reason,
        }),
      },
    );

    // Safe now because we're using the stored form reference.
    form.reset();

    await load();

    setPopup({
      type: 'success',
      title:
        kind === 'stock-in'
          ? 'Stock In Successful'
          : 'Adjustment Successful',
      message: `${item.name} inventory was updated successfully.`,
      details: [
        `Quantity: ${quantity} ${item.unit}`,
        `New Stock: ${result.quantityOnHand} ${item.unit}`,
        `Reason: ${reason}`,
      ],
    });
  } catch (e) {
    setPopup({
      type: 'error',
      title:
        kind === 'stock-in'
          ? 'Stock In Failed'
          : 'Adjustment Failed',
      message:
        e instanceof Error
          ? e.message
          : 'An unexpected error occurred.',
      details: [
        `Item: ${item.name}`,
        `Current Stock: ${item.quantityOnHand} ${item.unit}`,
        `Requested Quantity: ${quantity} ${item.unit}`,
        `Reason: ${reason}`,
      ],
    });
  }
}

  /*
   * ------------------------------------------------
   * ERROR POPUP HELPER
   * ------------------------------------------------
   */
  function showFailure(
    error: unknown,
    title: string,
    details: string[],
  ) {
    if (error instanceof ApiError) {
      setPopup({
        type: 'error',

        title,

        message: error.message,

        details: [
          `HTTP Status: ${error.status}`,
          ...details,
        ],
      });

      return;
    }

    setPopup({
      type: 'error',

      title,

      message:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',

      details,
    });
  }

  function formatQuantity(
    quantity: string,
  ) {
    const number =
      Number(quantity);

    if (
      !Number.isNaN(number) &&
      number > 0
    ) {
      return `+${quantity}`;
    }

    return quantity;
  }

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Inventory</h1>

          <p>
            Retail products and service
            consumables
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* ADD INVENTORY */}

      <div className="card-estylo mb-4">
        <h5>Add Inventory Item</h5>

        <form
          className="row g-2"
          onSubmit={create}
        >
          <div className="col-md-2">
            <input
              name="sku"
              className="form-control"
              placeholder="SKU"
              required
            />
          </div>

          <div className="col-md-2">
            <input
              name="name"
              className="form-control"
              placeholder="Item name"
              required
            />
          </div>

          <div className="col-md-2">
            <select
              name="type"
              className="form-select"
            >
              <option>
                RETAIL
              </option>

              <option>
                CONSUMABLE
              </option>

              <option>
                RETAIL_AND_CONSUMABLE
              </option>
            </select>
          </div>

          <div className="col-md-1">
            <input
              name="unit"
              className="form-control"
              placeholder="pcs/ml"
              required
            />
          </div>

          <div className="col-md-1">
            <input
              name="quantityOnHand"
              className="form-control"
              inputMode="decimal"
              placeholder="Stock"
              required
            />
          </div>

          <div className="col-md-1">
            <input
              name="warningLevel"
              className="form-control"
              inputMode="decimal"
              placeholder="Warn"
              required
            />
          </div>

          <div className="col-md-1">
            <input
              name="reorderLevel"
              className="form-control"
              inputMode="decimal"
              placeholder="Reorder"
              required
            />
          </div>

          <div className="col-md-1">
            <input
              name="sellingPrice"
              className="form-control"
              inputMode="decimal"
              placeholder="Price"
            />
          </div>

          <div className="col-md-1">
            <button
              type="submit"
              className="btn btn-estylo w-100"
            >
              Add
            </button>
          </div>
        </form>
      </div>

      {/* INVENTORY TABLE */}

      <div className="card-estylo table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Type</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Retail Price</th>
              <th>Movement</th>
            </tr>
          </thead>

          <tbody>
            {items.map(
              (item) => (
                <tr key={item.id}>
                  <td>
                    {item.sku}
                  </td>

                  <td>
                    <strong>
                      {item.name}
                    </strong>

                    <div className="muted small">
                      Warn{' '}
                      {
                        item.warningLevel
                      }
                      {' · '}
                      Reorder{' '}
                      {
                        item.reorderLevel
                      }
                    </div>
                  </td>

                  <td>
                    {item.type.replaceAll(
                      '_',
                      ' ',
                    )}
                  </td>

                  <td>
                    {
                      item.quantityOnHand
                    }{' '}
                    {item.unit}
                  </td>

                  <td>
                    <span
                      className={
                        `badge-stock ${item.stockStatus}`
                      }
                    >
                      {
                        item.stockStatus
                      }
                    </span>
                  </td>

                  <td>
                    {item.sellingPrice
                      ? money(
                          item.sellingPrice,
                        )
                      : '—'}
                  </td>

                  <td>
                    <details>
                      <summary className="btn btn-sm btn-outline-secondary">
                        Update
                      </summary>

                      {/* STOCK IN */}

                      <form
                        className="d-flex gap-2 mt-2"
                        onSubmit={(e) =>
                          move(
                            e,
                            item,
                            'stock-in',
                          )
                        }
                      >
                        <input
                          name="quantity"
                          inputMode="decimal"
                          className="form-control form-control-sm"
                          placeholder="+ Qty"
                          style={{
                            width: 90,
                          }}
                          required
                        />

                        <input
                          name="reason"
                          className="form-control form-control-sm"
                          placeholder="Stock-in reason"
                          required
                        />

                        <button
                          type="submit"
                          className="btn btn-sm btn-estylo"
                        >
                          Stock In
                        </button>
                      </form>

                      {/* ADJUST */}

                      <form
                        className="d-flex gap-2 mt-2"
                        onSubmit={(e) =>
                          move(
                            e,
                            item,
                            'adjust',
                          )
                        }
                      >
                        <input
                          name="quantity"
                          inputMode="decimal"
                          className="form-control form-control-sm"
                          placeholder="+/- Qty"
                          style={{
                            width: 90,
                          }}
                          required
                        />

                        <input
                          name="reason"
                          className="form-control form-control-sm"
                          placeholder="Adjustment reason"
                          required
                        />

                        <button
                          type="submit"
                          className="btn btn-sm btn-outline-dark"
                        >
                          Adjust
                        </button>
                      </form>
                    </details>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* RESULT POPUP */}

      {/* {popup && (
        <div
          className="result-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`result-card ${
              popup.type
            }`}
          >
            <div
              className={`result-icon ${
                popup.type
              }`}
            >
              {popup.type ===
              'success'
                ? '✓'
                : '!'}
            </div>

            <h3>
              {popup.title}
            </h3>

            <p className="result-message">
              {popup.message}
            </p>

            {popup.details &&
              popup.details.length >
                0 && (
                <div className="result-details">
                  {popup.details.map(
                    (
                      detail,
                      index,
                    ) => (
                      <div
                        key={
                          index
                        }
                      >
                        {
                          detail
                        }
                      </div>
                    ),
                  )}
                </div>
              )}

            <button
              type="button"
              className={
                popup.type ===
                'success'
                  ? 'btn btn-estylo result-close'
                  : 'btn btn-danger result-close'
              }
              onClick={() =>
                setPopup(null)
              }
            >
              OK
            </button>
          </div>
        </div>
      )} */}

    {popup && (
  <div
    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
    style={{
      backgroundColor: 'rgba(0,0,0,0.55)',
      zIndex: 9999,
      padding: '20px',
    }}
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
          {popup.type === 'success' ? '✓' : '!'}
        </div>

        <h4 className="mt-3 mb-2">
          {popup.title}
        </h4>

        <p className="text-muted">
          {popup.message}
        </p>

        {popup.details && (
          <div
            className="bg-light rounded p-3 text-start mb-3"
            style={{
              fontSize: '0.9rem',
            }}
          >
            {popup.details.map((detail, index) => (
              <div key={index}>
                {detail}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={
            popup.type === 'success'
              ? 'btn btn-estylo px-5'
              : 'btn btn-danger px-5'
          }
          onClick={() => setPopup(null)}
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