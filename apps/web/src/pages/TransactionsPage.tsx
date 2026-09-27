import { useCallback, useEffect, useState } from 'react';
import { api, money } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type TransactionTypeFilter = 'ALL' | 'SERVICE' | 'ITEM';

type Transaction = {
  transactionId: string;
  type: 'SERVICE' | 'ITEM';
  createdAt: string;
  amount: string;
  tip: string;
  status: 'ACTIVE' | 'VOID';
  cashier: string;
  barber: string | null;
  seat: string | null;
};

type Barber = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  displayOrder: number;
};

type TransactionsResponse = {
  data: Transaction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    sumTotalAmount: string;
  };
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
});

export function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sumTotalAmount, setSumTotalAmount] = useState('0.00');

  const [type, setType] = useState<TransactionTypeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [barberId, setBarberId] = useState('');

  const loadTransactions = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setTransactions([]);
      setTotal(0);
      setTotalPages(1);
      setSumTotalAmount('0.00');
      setError('Date From cannot be later than Date To.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (type !== 'ALL') {
        params.set('type', type);
      }

      if (dateFrom) {
        params.set('dateFrom', dateFrom);
      }

      if (dateTo) {
        params.set('dateTo', dateTo);
      }

      if (barberId) {
        params.set('barberId', barberId);
      }

      const response = await api<TransactionsResponse>(
        `/transactions?${params.toString()}`,
      );

      setTransactions(response.data);
      setPage(response.pagination.page);
      setPageSize(response.pagination.pageSize);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
      setSumTotalAmount(response.summary.sumTotalAmount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type, dateFrom, dateTo, barberId]);

  useEffect(() => {
    void api<Barber[]>('/barbers/all')
      .then(setBarbers)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function voidTx(id: string) {
    const reason = prompt('Reason for void:');

    if (!reason?.trim()) {
      return;
    }

    try {
      setError('');

      await api(`/transactions/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });

      await loadTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to void transaction.');
    }
  }

  function resetFilters() {
    setPage(1);
    setType('ALL');
    setDateFrom('');
    setDateTo('');
    setBarberId('');
  }

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Transactions</h1>
          <p>Service and item sales remain separately recorded.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card-estylo mb-3">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-6 col-xl-2">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as TransactionTypeFilter;
                setPage(1);
                setType(nextType);

                if (nextType === 'ITEM') {
                  setBarberId('');
                }
              }}
            >
              <option value="ALL">All Types</option>
              <option value="SERVICE">Service</option>
              <option value="ITEM">Item / Product</option>
            </select>
          </div>

          <div className="col-12 col-md-6 col-xl-2">
            <label className="form-label">Date From</label>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
            />
          </div>

          <div className="col-12 col-md-6 col-xl-2">
            <label className="form-label">Date To</label>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
            />
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label">Barber</label>
            <select
              className="form-select"
              value={barberId}
              disabled={type === 'ITEM'}
              onChange={(e) => {
                setPage(1);
                setBarberId(e.target.value);
              }}
            >
              <option value="">All Barbers</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                  {!barber.active ? ' (Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 col-xl-1">
            <label className="form-label">Rows</label>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={150}>150</option>
            </select>
          </div>

          <div className="col-12 col-md-6 col-xl-2 d-grid">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={resetFilters}
              disabled={loading}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <small className="text-muted">
          {loading
            ? 'Loading transactions...'
            : `Showing ${firstRow}-${lastRow} of ${total} transaction${total === 1 ? '' : 's'}`}
        </small>

        <div className="d-flex flex-wrap align-items-center gap-3">
          <small className="text-muted">
            <strong>Sum of Total Amount:</strong>{' '}
            {money(sumTotalAmount)}
          </small>

          <small className="text-muted">
            Page {page} of {totalPages}
          </small>
        </div>
      </div>

      <div className="card-estylo table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Type</th>
              <th>Date</th>
              <th>Barber / Seat</th>
              <th>Cashier</th>
              <th>
                Amount
                <div className="small text-muted fw-normal">
                  Sum: {money(sumTotalAmount)}
                </div>
              </th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {!loading && transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-4">
                  No transactions found for the selected filters.
                </td>
              </tr>
            )}

            {transactions.map((transaction) => (
              <tr key={transaction.transactionId}>
                <td>
                  <strong>{transaction.transactionId}</strong>
                </td>

                <td>
                  <span
                    className={`badge ${
                      transaction.type === 'SERVICE'
                        ? 'text-bg-dark'
                        : 'text-bg-secondary'
                    }`}
                  >
                    {transaction.type}
                  </span>
                </td>

                <td>{dateTimeFormatter.format(new Date(transaction.createdAt))}</td>

                <td>
                  {transaction.barber
                    ? `${transaction.barber} · ${transaction.seat ?? '—'}`
                    : '—'}
                </td>

                <td>{transaction.cashier}</td>

                <td>
                  {money(Number(transaction.amount) + Number(transaction.tip))}
                </td>

                <td>
                  <span
                    className={`badge ${
                      transaction.status === 'ACTIVE'
                        ? 'text-bg-success'
                        : 'text-bg-secondary'
                    }`}
                  >
                    {transaction.status}
                  </span>
                </td>

                <td className="text-end">
                  {user?.role === 'ADMIN' && transaction.status === 'ACTIVE' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => void voidTx(transaction.transactionId)}
                    >
                      Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
        <small className="text-muted">
          {total === 0
            ? 'No transactions'
            : `${firstRow}-${lastRow} of ${total}`}
        </small>

        <div className="btn-group" role="group" aria-label="Transaction pagination">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage(1)}
          >
            First
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>

          <button type="button" className="btn btn-outline-secondary" disabled>
            {page} / {totalPages}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={loading || page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            Next
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={loading || page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
