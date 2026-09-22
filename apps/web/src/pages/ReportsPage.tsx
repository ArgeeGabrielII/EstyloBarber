import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js';

import {
  Bar,
} from 'react-chartjs-2';

import {
  api,
  money,
} from '../api/client';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

type ReportMode =
  | 'daily'
  | 'monthly';

type PeriodRow = {
  key: string;
  label: string;

  serviceCount: number;

  serviceRevenue: number;

  itemRevenue: number;

  tips: number;
};

type NamedSeries = {
  name: string;
  values: number[];
};

type ServiceBreakdown = {
  service: string;
  count: number;
  revenue: number;
};

type BarberBreakdown = {
  barber: string;

  services: number;

  revenue: number;

  tips: number;

  total: number;
};

type DetailedReport = {
  mode: ReportMode;

  selectedMonth:
    | string
    | null;

  selectedYear: number;

  periodLabel: string;

  totals: {
    serviceCount: number;

    serviceRevenue: number;

    itemRevenue: number;

    tips: number;

    totalCollected: number;
  };

  periods:
    PeriodRow[];

  serviceSeries:
    NamedSeries[];

  barberSalesSeries:
    NamedSeries[];

  productSalesSeries:
    NamedSeries[];

  serviceBreakdown:
    ServiceBreakdown[];

  barberBreakdown:
    BarberBreakdown[];
};

/*
 * Estylo-inspired chart palette.
 */

const COLORS = [
  '#BD9956',
  '#202020',
  '#9E764E',
  '#6F5A34',
  '#D2B77E',
  '#6C757D',
  '#8A6F42',
  '#3F3F3F',
  '#C8A86B',
  '#A7A7A7',
  '#7A5C2E',
  '#E0C995',
];

function currentMonthManila() {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'Asia/Manila',

        year:
          'numeric',

        month:
          '2-digit',
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        'year',
    )?.value ??
    '2026';

  const month =
    parts.find(
      (part) =>
        part.type ===
        'month',
    )?.value ??
    '01';

  return `${year}-${month}`;
}

function currentYearManila() {
  const year =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone:
          'Asia/Manila',

        year:
          'numeric',
      },
    ).format(
      new Date(),
    );

  return Number(
    year,
  );
}

export function ReportsPage() {
  const [
    mode,
    setMode,
  ] =
    useState<ReportMode>(
      'daily',
    );

  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState(
      currentMonthManila(),
    );

  const [
    selectedYear,
    setSelectedYear,
  ] =
    useState(
      currentYearManila(),
    );

  const [
    report,
    setReport,
  ] =
    useState<
      DetailedReport | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  /*
   * ==========================================================
   * LOAD REPORT
   * ==========================================================
   */

  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        setLoading(
          true,
        );

        setError('');

        try {
          const query =
            mode ===
            'daily'
              ? `/reports/detailed?mode=daily&month=${encodeURIComponent(
                  selectedMonth,
                )}`
              : `/reports/detailed?mode=monthly&year=${selectedYear}`;

          const result =
            await api<DetailedReport>(
              query,
            );

          if (
            !cancelled
          ) {
            setReport(
              result,
            );
          }
        } catch (e) {
          if (
            !cancelled
          ) {
            setError(
              e instanceof
                Error
                ? e.message
                : 'Failed to load report.',
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },

    [
      mode,
      selectedMonth,
      selectedYear,
    ],
  );

  /*
   * ==========================================================
   * LABELS
   * ==========================================================
   */

  const labels =
    report?.periods.map(
      (period) =>
        period.label,
    ) ?? [];

  /*
   * ==========================================================
   * NO. OF SERVICES
   *
   * Stacked vertical bars.
   *
   * Each service is its own segment.
   * ==========================================================
   */

  const serviceCountData =
    useMemo(
      () => ({
        labels,

        datasets:
          report?.serviceSeries.map(
            (
              series,
              index,
            ) => ({
              label:
                series.name,

              data:
                series.values,

              backgroundColor:
                COLORS[
                  index %
                    COLORS.length
                ],

              borderWidth:
                0,

              stack:
                'services',
            }),
          ) ?? [],
      }),

      [
        labels,
        report,
      ],
    );

  /*
   * ==========================================================
   * SERVICE REVENUE
   * ==========================================================
   */

  const serviceRevenueData =
    useMemo(
      () => ({
        labels,

        datasets: [
          {
            label:
              'Service Revenue',

            data:
              report?.periods.map(
                (period) =>
                  period
                    .serviceRevenue,
              ) ?? [],

            backgroundColor:
              '#BD9956',

            borderWidth:
              0,
          },
        ],
      }),

      [
        labels,
        report,
      ],
    );

  /*
   * ==========================================================
   * PER BARBER SALES
   * ==========================================================
   */

  const barberSalesData =
    useMemo(
      () => ({
        labels,

        datasets:
          report?.barberSalesSeries.map(
            (
              series,
              index,
            ) => ({
              label:
                series.name,

              data:
                series.values,

              backgroundColor:
                COLORS[
                  index %
                    COLORS.length
                ],

              borderWidth:
                0,

              stack:
                'barbers',
            }),
          ) ?? [],
      }),

      [
        labels,
        report,
      ],
    );

  /*
   * ==========================================================
   * PER PRODUCT SALES
   * ==========================================================
   */

  const productSalesData =
    useMemo(
      () => ({
        labels,

        datasets:
          report?.productSalesSeries.map(
            (
              series,
              index,
            ) => ({
              label:
                series.name,

              data:
                series.values,

              backgroundColor:
                COLORS[
                  index %
                    COLORS.length
                ],

              borderWidth:
                0,

              stack:
                'products',
            }),
          ) ?? [],
      }),

      [
        labels,
        report,
      ],
    );

  /*
   * ==========================================================
   * SERVICE COUNT CHART OPTIONS
   * ==========================================================
   */

  const countChartOptions =
    useMemo(
      () => ({
        responsive:
          true,

        maintainAspectRatio:
          false,

        interaction: {
          mode:
            'index' as const,

          intersect:
            false,
        },

        plugins: {
          legend: {
            display:
              true,

            position:
              'bottom' as const,
          },

          tooltip: {
            mode:
              'index' as const,

            intersect:
              false,
          },
        },

        scales: {
          x: {
            stacked:
              true,

            ticks: {
              autoSkip:
                false,

              maxRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              minRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              font: {
                size:
                  mode ===
                  'daily'
                    ? 10
                    : 12,
              },
            },

            grid: {
              display:
                false,
            },
          },

          y: {
            stacked:
              true,

            beginAtZero:
              true,

            ticks: {
              precision:
                0,
            },

            title: {
              display:
                true,

              text:
                'Number of Services',
            },
          },
        },
      }),

      [
        mode,
      ],
    );

  /*
   * ==========================================================
   * SERVICE REVENUE CHART OPTIONS
   * ==========================================================
   */

  const revenueChartOptions =
    useMemo(
      () => ({
        responsive:
          true,

        maintainAspectRatio:
          false,

        interaction: {
          mode:
            'index' as const,

          intersect:
            false,
        },

        plugins: {
          legend: {
            display:
              false,
          },

          tooltip: {
            mode:
              'index' as const,

            intersect:
              false,
          },
        },

        scales: {
          x: {
            stacked:
              false,

            ticks: {
              autoSkip:
                false,

              maxRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              minRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              font: {
                size:
                  mode ===
                  'daily'
                    ? 10
                    : 12,
              },
            },

            grid: {
              display:
                false,
            },
          },

          y: {
            beginAtZero:
              true,

            title: {
              display:
                true,

              text:
                'Revenue (PHP)',
            },
          },
        },
      }),

      [
        mode,
      ],
    );

  /*
   * ==========================================================
   * STACKED REVENUE CHART OPTIONS
   *
   * Barber / Product sales
   * ==========================================================
   */

  const stackedRevenueChartOptions =
    useMemo(
      () => ({
        responsive:
          true,

        maintainAspectRatio:
          false,

        interaction: {
          mode:
            'index' as const,

          intersect:
            false,
        },

        plugins: {
          legend: {
            display:
              true,

            position:
              'bottom' as const,
          },

          tooltip: {
            mode:
              'index' as const,

            intersect:
              false,
          },
        },

        scales: {
          x: {
            stacked:
              true,

            ticks: {
              autoSkip:
                false,

              maxRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              minRotation:
                mode ===
                'daily'
                  ? 45
                  : 0,

              font: {
                size:
                  mode ===
                  'daily'
                    ? 10
                    : 12,
              },
            },

            grid: {
              display:
                false,
            },
          },

          y: {
            stacked:
              true,

            beginAtZero:
              true,

            title: {
              display:
                true,

              text:
                'Sales (PHP)',
            },
          },
        },
      }),

      [
        mode,
      ],
    );

  const periodWord =
    mode === 'daily'
      ? 'Date'
      : 'Month';

  return (
    <div className="page">
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="page-title">
        <div>
          <h1>
            Reports
          </h1>

          <p>
            Daily and monthly
            service, barber,
            product, and revenue
            reports.
          </p>
        </div>

        <div className="btn-group">
          <button
            type="button"
            className={`btn ${
              mode ===
              'daily'
                ? 'btn-estylo'
                : 'btn-outline-secondary'
            }`}
            onClick={() =>
              setMode(
                'daily',
              )
            }
          >
            Daily
          </button>

          <button
            type="button"
            className={`btn ${
              mode ===
              'monthly'
                ? 'btn-estylo'
                : 'btn-outline-secondary'
            }`}
            onClick={() =>
              setMode(
                'monthly',
              )
            }
          >
            Monthly
          </button>
        </div>
      </div>

      {/* ====================================================
          FILTER
      ==================================================== */}

      <div className="card-estylo mb-4">
        <div className="row g-3 align-items-end">
          {mode ===
          'daily' ? (
            <div className="col-md-4 col-lg-3">
              <label className="form-label">
                Report Month
              </label>

              <input
                type="month"
                className="form-control"
                value={
                  selectedMonth
                }
                onChange={(
                  event,
                ) =>
                  setSelectedMonth(
                    event
                      .target
                      .value,
                  )
                }
              />
            </div>
          ) : (
            <div className="col-md-4 col-lg-3">
              <label className="form-label">
                Report Year
              </label>

              <input
                type="number"
                className="form-control"
                min="2000"
                max="2200"
                value={
                  selectedYear
                }
                onChange={(
                  event,
                ) =>
                  setSelectedYear(
                    Number(
                      event
                        .target
                        .value,
                    ) ||
                      currentYearManila(),
                  )
                }
              />
            </div>
          )}

          <div className="col-md-8 col-lg-9">
            <div className="text-muted small">
              {mode ===
              'daily'
                ? 'All dates in the selected month are shown. Dates without transactions, including future dates, remain visible with a zero value.'
                : 'All 12 months in the selected year are shown. Months without transactions, including future months, remain visible with a zero value.'}
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* ====================================================
          LOADING
      ==================================================== */}

      {loading && (
        <div className="alert alert-secondary">
          Loading report...
        </div>
      )}

      {/* ====================================================
          PERIOD TITLE
      ==================================================== */}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0">
          {report?.periodLabel ??
            'Report'}
        </h5>
      </div>

      {/* ====================================================
          SUMMARY CARDS
      ==================================================== */}

      <div className="metric-grid mb-4">
        <div className="card-estylo">
          <div className="metric-label">
            Total Services
          </div>

          <div className="metric-value">
            {report?.totals
              .serviceCount ??
              0}
          </div>
        </div>

        <div className="card-estylo">
          <div className="metric-label">
            Service Revenue
          </div>

          <div className="metric-value">
            {money(
              report?.totals
                .serviceRevenue ??
                0,
            )}
          </div>
        </div>

        <div className="card-estylo">
          <div className="metric-label">
            Product Revenue
          </div>

          <div className="metric-value">
            {money(
              report?.totals
                .itemRevenue ??
                0,
            )}
          </div>
        </div>

        <div className="card-estylo">
          <div className="metric-label">
            Tips
          </div>

          <div className="metric-value">
            {money(
              report?.totals
                .tips ??
                0,
            )}
          </div>
        </div>

        <div className="card-estylo">
          <div className="metric-label">
            Total Collected
          </div>

          <div className="metric-value">
            {money(
              report?.totals
                .totalCollected ??
                0,
            )}
          </div>
        </div>
      </div>

      {/* ====================================================
          NO. OF SERVICES BY DATE / MONTH
      ==================================================== */}

      <div className="card-estylo mb-4">
        <div className="mb-3">
          <h5 className="mb-1">
            No. of Services by{' '}
            {periodWord}
          </h5>

          <small className="text-muted">
            Vertical stacked bars
            show the service
            breakdown for every{' '}
            {mode ===
            'daily'
              ? 'date'
              : 'month'}
            .
          </small>
        </div>

        <div className="chart-box">
          <Bar
            data={
              serviceCountData
            }
            options={
              countChartOptions
            }
          />
        </div>
      </div>

      {/* ====================================================
          SERVICE REVENUE
      ==================================================== */}

      <div className="card-estylo mb-4">
        <div className="mb-3">
          <h5 className="mb-1">
            Services Revenue by{' '}
            {periodWord}
          </h5>

          <small className="text-muted">
            Service revenue only.
            Tips and product sales
            are excluded.
          </small>
        </div>

        <div className="chart-box">
          <Bar
            data={
              serviceRevenueData
            }
            options={
              revenueChartOptions
            }
          />
        </div>
      </div>

      {/* ====================================================
          PER BARBER SALES
      ==================================================== */}

      <div className="card-estylo mb-4">
        <div className="mb-3">
          <h5 className="mb-1">
            Per Barber Sales per{' '}
            {periodWord}
          </h5>

          <small className="text-muted">
            Vertical stacked bars
            show service revenue
            attributed to each
            barber.
          </small>
        </div>

        <div className="chart-box">
          <Bar
            data={
              barberSalesData
            }
            options={
              stackedRevenueChartOptions
            }
          />
        </div>
      </div>

      {/* ====================================================
          PRODUCT SALES
      ==================================================== */}

      <div className="card-estylo mb-4">
        <div className="mb-3">
          <h5 className="mb-1">
            Per Product Sales per{' '}
            {periodWord}
          </h5>

          <small className="text-muted">
            Vertical stacked bars
            show product-sales
            revenue for each
            product.
          </small>
        </div>

        <div className="chart-box">
          <Bar
            data={
              productSalesData
            }
            options={
              stackedRevenueChartOptions
            }
          />
        </div>
      </div>

      {/* ====================================================
          BREAKDOWN TABLES
      ==================================================== */}

      <div className="row g-4">
        {/* ==================================================
            BARBER BREAKDOWN
        ================================================== */}

        <div className="col-xl-6">
          <div className="card-estylo table-wrap h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h5 className="mb-1">
                  Barber Breakdown
                </h5>

                <small className="text-muted">
                  Totals for{' '}
                  {report?.periodLabel ??
                    'the selected period'}
                  .
                </small>
              </div>
            </div>

            <table className="table align-middle">
              <thead>
                <tr>
                  <th>
                    Barber
                  </th>

                  <th className="text-end">
                    Services
                  </th>

                  <th className="text-end">
                    Service Sales
                  </th>

                  <th className="text-end">
                    Tips
                  </th>

                  <th className="text-end">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {!report
                  ?.barberBreakdown
                  .length ? (
                  <tr>
                    <td
                      colSpan={
                        5
                      }
                      className="text-center text-muted py-4"
                    >
                      No barber
                      sales for this
                      period.
                    </td>
                  </tr>
                ) : (
                  report.barberBreakdown.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.barber
                        }
                      >
                        <td>
                          <strong>
                            {
                              row.barber
                            }
                          </strong>
                        </td>

                        <td className="text-end">
                          {
                            row.services
                          }
                        </td>

                        <td className="text-end">
                          {money(
                            row.revenue,
                          )}
                        </td>

                        <td className="text-end">
                          {money(
                            row.tips,
                          )}
                        </td>

                        <td className="text-end">
                          <strong>
                            {money(
                              row.total,
                            )}
                          </strong>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================
            SERVICE BREAKDOWN
        ================================================== */}

        <div className="col-xl-6">
          <div className="card-estylo table-wrap h-100">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h5 className="mb-1">
                  Service Breakdown
                </h5>

                <small className="text-muted">
                  Totals for{' '}
                  {report?.periodLabel ??
                    'the selected period'}
                  .
                </small>
              </div>
            </div>

            <table className="table align-middle">
              <thead>
                <tr>
                  <th>
                    Service
                  </th>

                  <th className="text-end">
                    No. of
                    Services
                  </th>

                  <th className="text-end">
                    Revenue
                  </th>
                </tr>
              </thead>

              <tbody>
                {!report
                  ?.serviceBreakdown
                  .length ? (
                  <tr>
                    <td
                      colSpan={
                        3
                      }
                      className="text-center text-muted py-4"
                    >
                      No services
                      for this
                      period.
                    </td>
                  </tr>
                ) : (
                  report.serviceBreakdown.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.service
                        }
                      >
                        <td>
                          <strong>
                            {
                              row.service
                            }
                          </strong>
                        </td>

                        <td className="text-end">
                          {
                            row.count
                          }
                        </td>

                        <td className="text-end">
                          {money(
                            row.revenue,
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}