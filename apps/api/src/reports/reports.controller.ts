import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  TransactionStatus,
  UserRole,
} from '@prisma/client';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

function phDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function php(value: number) {
  return Math.round(value * 100) / 100;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function monthName(month: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(
    new Date(
      Date.UTC(
        2026,
        month - 1,
        1,
      ),
    ),
  );
}

function startOfPhDay(date: string) {
  return new Date(
    `${date}T00:00:00+08:00`,
  );
}

function nextMonth(
  year: number,
  month: number,
) {
  if (month === 12) {
    return {
      year: year + 1,
      month: 1,
    };
  }

  return {
    year,
    month: month + 1,
  };
}

@Controller('reports')
@UseGuards(
  AuthGuard,
  RolesGuard,
)
@Roles(
  UserRole.ADMIN,
  UserRole.VIEWER,
)
export class ReportsController {
  constructor(
    private prisma: PrismaService,
  ) {}

  /*
   * ============================================================
   * DETAILED REPORT
   *
   * DAILY:
   * /api/reports/detailed?mode=daily&month=2026-09
   *
   * MONTHLY:
   * /api/reports/detailed?mode=monthly&year=2026
   * ============================================================
   */

  @Get('detailed')
  async detailed(
    @Query('mode')
    modeRaw = 'daily',

    @Query('month')
    monthRaw?: string,

    @Query('year')
    yearRaw?: string,
  ) {
    const mode =
      modeRaw === 'monthly'
        ? 'monthly'
        : 'daily';

    const today =
      phDate(new Date());

    const currentYear =
      Number(
        today.slice(0, 4),
      );

    const currentMonth =
      Number(
        today.slice(5, 7),
      );

    let rangeStart: Date;
    let rangeEnd: Date;

    let periodLabel: string;

    const bucketKeys: string[] = [];
    const bucketLabels: string[] = [];

    let selectedMonth:
      | string
      | null = null;

    let selectedYear: number;

    /*
     * ========================================================
     * DAILY REPORT
     *
     * Builds ALL dates in the selected month.
     *
     * Example:
     *
     * Sep 1
     * Sep 2
     * ...
     * Sep 30
     *
     * Even future dates remain in the result with zero values.
     * ========================================================
     */

    if (mode === 'daily') {
      const monthValue =
        monthRaw ??
        `${currentYear}-${pad(
          currentMonth,
        )}`;

      if (
        !/^\d{4}-\d{2}$/.test(
          monthValue,
        )
      ) {
        throw new BadRequestException(
          'month must use YYYY-MM format.',
        );
      }

      const year =
        Number(
          monthValue.slice(
            0,
            4,
          ),
        );

      const month =
        Number(
          monthValue.slice(
            5,
            7,
          ),
        );

      if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2200
      ) {
        throw new BadRequestException(
          'Invalid report year.',
        );
      }

      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        throw new BadRequestException(
          'Invalid report month.',
        );
      }

      selectedMonth =
        `${year}-${pad(month)}`;

      selectedYear = year;

      const numberOfDays =
        new Date(
          Date.UTC(
            year,
            month,
            0,
          ),
        ).getUTCDate();

      for (
        let day = 1;
        day <= numberOfDays;
        day += 1
      ) {
        bucketKeys.push(
          `${year}-${pad(
            month,
          )}-${pad(day)}`,
        );

        bucketLabels.push(
          `${monthName(
            month,
          )} ${day}`,
        );
      }

      const followingMonth =
        nextMonth(
          year,
          month,
        );

      rangeStart =
        startOfPhDay(
          `${year}-${pad(
            month,
          )}-01`,
        );

      rangeEnd =
        startOfPhDay(
          `${
            followingMonth.year
          }-${pad(
            followingMonth.month,
          )}-01`,
        );

      periodLabel =
        `${monthName(
          month,
        )} ${year}`;
    }

    /*
     * ========================================================
     * MONTHLY REPORT
     *
     * Builds ALL 12 months.
     *
     * Jan - Dec
     *
     * Future months remain visible with zero values.
     * ========================================================
     */
    else {
      const year =
        Number(
          yearRaw ??
            currentYear,
        );

      if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2200
      ) {
        throw new BadRequestException(
          'Invalid report year.',
        );
      }

      selectedYear = year;

      for (
        let month = 1;
        month <= 12;
        month += 1
      ) {
        bucketKeys.push(
          `${year}-${pad(
            month,
          )}`,
        );

        bucketLabels.push(
          monthName(month),
        );
      }

      rangeStart =
        startOfPhDay(
          `${year}-01-01`,
        );

      rangeEnd =
        startOfPhDay(
          `${year + 1}-01-01`,
        );

      periodLabel =
        String(year);
    }

    /*
     * ========================================================
     * LOAD TRANSACTIONS
     * ========================================================
     */

    const [
      serviceTransactions,
      itemTransactions,
    ] =
      await Promise.all([
        this.prisma
          .serviceTransaction
          .findMany({
            where: {
              status:
                TransactionStatus.ACTIVE,

              createdAt: {
                gte:
                  rangeStart,

                lt:
                  rangeEnd,
              },
            },

            include: {
              lines: true,
              barber: true,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          }),

        this.prisma
          .itemTransaction
          .findMany({
            where: {
              status:
                TransactionStatus.ACTIVE,

              createdAt: {
                gte:
                  rangeStart,

                lt:
                  rangeEnd,
              },
            },

            include: {
              lines: true,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          }),
      ]);

    /*
     * ========================================================
     * DATE → BUCKET
     * ========================================================
     */

    const keyForDate = (
      date: Date,
    ) => {
      const day =
        phDate(date);

      return mode ===
        'daily'
        ? day
        : day.slice(
            0,
            7,
          );
    };

    const bucketIndex =
      new Map(
        bucketKeys.map(
          (
            key,
            index,
          ) =>
            [
              key,
              index,
            ] as const,
        ),
      );

    /*
     * Base arrays already contain zero.
     *
     * This creates the zero-value placeholders.
     */

    const serviceCount =
      bucketKeys.map(
        () => 0,
      );

    const serviceRevenue =
      bucketKeys.map(
        () => 0,
      );

    const itemRevenue =
      bucketKeys.map(
        () => 0,
      );

    const tips =
      bucketKeys.map(
        () => 0,
      );

    /*
     * ========================================================
     * SERIES MAPS
     * ========================================================
     */

    const serviceNames =
      new Set<string>();

    const barberNames =
      new Set<string>();

    const productNames =
      new Set<string>();

    const servicesByPeriod =
      new Map<
        string,
        number[]
      >();

    const barberSalesByPeriod =
      new Map<
        string,
        number[]
      >();

    const productSalesByPeriod =
      new Map<
        string,
        number[]
      >();

    /*
     * ========================================================
     * SERVICE BREAKDOWN
     * ========================================================
     */

    const serviceBreakdown =
      new Map<
        string,
        {
          service: string;
          count: number;
          revenue: number;
        }
      >();

    /*
     * ========================================================
     * BARBER BREAKDOWN
     * ========================================================
     */

    const barberBreakdown =
      new Map<
        string,
        {
          barber: string;
          services: number;
          revenue: number;
          tips: number;
        }
      >();

    /*
     * ========================================================
     * PROCESS SERVICE TRANSACTIONS
     * ========================================================
     */

    for (
      const transaction
      of serviceTransactions
    ) {
      const key =
        keyForDate(
          transaction.createdAt,
        );

      const index =
        bucketIndex.get(
          key,
        );

      if (
        index === undefined
      ) {
        continue;
      }

      const transactionServiceCount =
        transaction.lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            line.quantity,
          0,
        );

      /*
       * Overall totals
       */

      serviceCount[
        index
      ] +=
        transactionServiceCount;

      serviceRevenue[
        index
      ] +=
        transaction
          .serviceAmount
          .toNumber();

      tips[index] +=
        transaction
          .tipAmount
          .toNumber();

      /*
       * BARBER SALES
       */

      const barberName =
        transaction
          .barber
          .name;

      barberNames.add(
        barberName,
      );

      if (
        !barberSalesByPeriod.has(
          barberName,
        )
      ) {
        barberSalesByPeriod.set(
          barberName,

          bucketKeys.map(
            () => 0,
          ),
        );
      }

      barberSalesByPeriod.get(
        barberName,
      )![index] +=
        transaction
          .serviceAmount
          .toNumber();

      /*
       * BARBER BREAKDOWN
       */

      const barberSummary =
        barberBreakdown.get(
          barberName,
        ) ?? {
          barber:
            barberName,

          services:
            0,

          revenue:
            0,

          tips:
            0,
        };

      barberSummary.services +=
        transactionServiceCount;

      barberSummary.revenue +=
        transaction
          .serviceAmount
          .toNumber();

      barberSummary.tips +=
        transaction
          .tipAmount
          .toNumber();

      barberBreakdown.set(
        barberName,
        barberSummary,
      );

      /*
       * SERVICE BREAKDOWN
       */

      for (
        const line
        of transaction.lines
      ) {
        const serviceName =
          line
            .serviceNameSnapshot;

        serviceNames.add(
          serviceName,
        );

        if (
          !servicesByPeriod.has(
            serviceName,
          )
        ) {
          servicesByPeriod.set(
            serviceName,

            bucketKeys.map(
              () => 0,
            ),
          );
        }

        servicesByPeriod.get(
          serviceName,
        )![index] +=
          line.quantity;

        const serviceSummary =
          serviceBreakdown.get(
            serviceName,
          ) ?? {
            service:
              serviceName,

            count:
              0,

            revenue:
              0,
          };

        serviceSummary.count +=
          line.quantity;

        serviceSummary.revenue +=
          line
            .lineTotal
            .toNumber();

        serviceBreakdown.set(
          serviceName,
          serviceSummary,
        );
      }
    }

    /*
     * ========================================================
     * PROCESS PRODUCT TRANSACTIONS
     * ========================================================
     */

    for (
      const transaction
      of itemTransactions
    ) {
      const key =
        keyForDate(
          transaction.createdAt,
        );

      const index =
        bucketIndex.get(
          key,
        );

      if (
        index === undefined
      ) {
        continue;
      }

      itemRevenue[
        index
      ] +=
        transaction
          .amount
          .toNumber();

      for (
        const line
        of transaction.lines
      ) {
        const productName =
          line
            .itemNameSnapshot;

        productNames.add(
          productName,
        );

        if (
          !productSalesByPeriod.has(
            productName,
          )
        ) {
          productSalesByPeriod.set(
            productName,

            bucketKeys.map(
              () => 0,
            ),
          );
        }

        productSalesByPeriod.get(
          productName,
        )![index] +=
          line
            .lineTotal
            .toNumber();
      }
    }

    /*
     * ========================================================
     * FINAL PERIOD DATA
     * ========================================================
     */

    const periods =
      bucketKeys.map(
        (
          key,
          index,
        ) => ({
          key,

          label:
            bucketLabels[
              index
            ],

          serviceCount:
            serviceCount[
              index
            ],

          serviceRevenue:
            php(
              serviceRevenue[
                index
              ],
            ),

          itemRevenue:
            php(
              itemRevenue[
                index
              ],
            ),

          tips:
            php(
              tips[
                index
              ],
            ),
        }),
      );

    /*
     * ========================================================
     * SERVICE SERIES
     * ========================================================
     */

    const serviceSeries =
      [...serviceNames]
        .sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
            ),
        )
        .map(
          (name) => ({
            name,

            values:
              servicesByPeriod.get(
                name,
              ) ??
              bucketKeys.map(
                () => 0,
              ),
          }),
        );

    /*
     * ========================================================
     * BARBER SALES SERIES
     * ========================================================
     */

    const barberSalesSeries =
      [...barberNames]
        .sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
            ),
        )
        .map(
          (name) => ({
            name,

            values:
              (
                barberSalesByPeriod.get(
                  name,
                ) ??
                bucketKeys.map(
                  () => 0,
                )
              ).map(
                php,
              ),
          }),
        );

    /*
     * ========================================================
     * PRODUCT SALES SERIES
     * ========================================================
     */

    const productSalesSeries =
      [...productNames]
        .sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
            ),
        )
        .map(
          (name) => ({
            name,

            values:
              (
                productSalesByPeriod.get(
                  name,
                ) ??
                bucketKeys.map(
                  () => 0,
                )
              ).map(
                php,
              ),
          }),
        );

    /*
     * ========================================================
     * TOTALS
     * ========================================================
     */

    const totalServiceRevenue =
      serviceRevenue.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      );

    const totalItemRevenue =
      itemRevenue.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      );

    const totalTips =
      tips.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      );

    const totalServices =
      serviceCount.reduce(
        (
          total,
          value,
        ) =>
          total +
          value,
        0,
      );

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    return {
      mode,

      selectedMonth,

      selectedYear,

      periodLabel,

      totals: {
        serviceCount:
          totalServices,

        serviceRevenue:
          php(
            totalServiceRevenue,
          ),

        itemRevenue:
          php(
            totalItemRevenue,
          ),

        tips:
          php(
            totalTips,
          ),

        totalCollected:
          php(
            totalServiceRevenue +
              totalItemRevenue +
              totalTips,
          ),
      },

      periods,

      serviceSeries,

      barberSalesSeries,

      productSalesSeries,

      serviceBreakdown:
        [
          ...serviceBreakdown.values(),
        ]
          .map(
            (row) => ({
              ...row,

              revenue:
                php(
                  row.revenue,
                ),
            }),
          )
          .sort(
            (
              a,
              b,
            ) =>
              b.count -
                a.count ||
              a.service.localeCompare(
                b.service,
              ),
          ),

      barberBreakdown:
        [
          ...barberBreakdown.values(),
        ]
          .map(
            (row) => ({
              ...row,

              revenue:
                php(
                  row.revenue,
                ),

              tips:
                php(
                  row.tips,
                ),

              total:
                php(
                  row.revenue +
                    row.tips,
                ),
            }),
          )
          .sort(
            (
              a,
              b,
            ) =>
              b.revenue -
                a.revenue ||
              a.barber.localeCompare(
                b.barber,
              ),
          ),
    };
  }

  /*
   * ============================================================
   * EXISTING SUMMARY REPORT
   *
   * Kept for compatibility.
   * ============================================================
   */

  @Get('summary')
  async summary(
    @Query('days')
    daysRaw = '30',

    @Query('groupBy')
    groupBy = 'daily',
  ) {
    const days =
      Math.min(
        Math.max(
          Number(
            daysRaw,
          ) || 30,
          1,
        ),

        180,
      );

    const from =
      new Date(
        Date.now() -
          (days - 1) *
            86400000,
      );

    from.setUTCHours(
      0,
      0,
      0,
      0,
    );

    const [
      svc,
      item,
    ] =
      await Promise.all([
        this.prisma
          .serviceTransaction
          .findMany({
            where: {
              status:
                TransactionStatus.ACTIVE,

              createdAt: {
                gte:
                  from,
              },
            },

            include: {
              lines: true,
              barber: true,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          }),

        this.prisma
          .itemTransaction
          .findMany({
            where: {
              status:
                TransactionStatus.ACTIVE,

              createdAt: {
                gte:
                  from,
              },
            },

            orderBy: {
              createdAt:
                'asc',
            },
          }),
      ]);

    const buckets =
      new Map<
        string,
        {
          label: string;
          serviceCount: number;
          serviceRevenue: number;
          itemRevenue: number;
          tips: number;
        }
      >();

    const keyFor = (
      date: Date,
    ) => {
      const day =
        phDate(date);

      if (
        groupBy !==
        'weekly'
      ) {
        return day;
      }

      const dt =
        new Date(
          `${day}T00:00:00Z`,
        );

      const dow =
        (
          dt.getUTCDay() +
          6
        ) %
        7;

      dt.setUTCDate(
        dt.getUTCDate() -
          dow,
      );

      return phDate(
        dt,
      );
    };

    const get = (
      date: Date,
    ) => {
      const key =
        keyFor(date);

      if (
        !buckets.has(
          key,
        )
      ) {
        buckets.set(
          key,
          {
            label:
              key,

            serviceCount:
              0,

            serviceRevenue:
              0,

            itemRevenue:
              0,

            tips:
              0,
          },
        );
      }

      return buckets.get(
        key,
      )!;
    };

    svc.forEach(
      (
        transaction,
      ) => {
        const bucket =
          get(
            transaction
              .createdAt,
          );

        bucket.serviceCount +=
          transaction.lines.reduce(
            (
              total,
              line,
            ) =>
              total +
              line.quantity,
            0,
          );

        bucket.serviceRevenue +=
          transaction
            .serviceAmount
            .toNumber();

        bucket.tips +=
          transaction
            .tipAmount
            .toNumber();
      },
    );

    item.forEach(
      (
        transaction,
      ) => {
        get(
          transaction.createdAt,
        ).itemRevenue +=
          transaction
            .amount
            .toNumber();
      },
    );

    const serviceBreakdown =
      new Map<
        string,
        {
          service: string;
          count: number;
          revenue: number;
        }
      >();

    for (
      const transaction
      of svc
    ) {
      for (
        const line
        of transaction.lines
      ) {
        const breakdown =
          serviceBreakdown.get(
            line
              .serviceNameSnapshot,
          ) ?? {
            service:
              line
                .serviceNameSnapshot,

            count:
              0,

            revenue:
              0,
          };

        breakdown.count +=
          line.quantity;

        breakdown.revenue +=
          line
            .lineTotal
            .toNumber();

        serviceBreakdown.set(
          line
            .serviceNameSnapshot,

          breakdown,
        );
      }
    }

    const barberBreakdown =
      new Map<
        string,
        {
          barber: string;
          services: number;
          revenue: number;
          tips: number;
        }
      >();

    for (
      const transaction
      of svc
    ) {
      const breakdown =
        barberBreakdown.get(
          transaction
            .barber
            .name,
        ) ?? {
          barber:
            transaction
              .barber
              .name,

          services:
            0,

          revenue:
            0,

          tips:
            0,
        };

      breakdown.services +=
        transaction.lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            line.quantity,
          0,
        );

      breakdown.revenue +=
        transaction
          .serviceAmount
          .toNumber();

      breakdown.tips +=
        transaction
          .tipAmount
          .toNumber();

      barberBreakdown.set(
        transaction
          .barber
          .name,

        breakdown,
      );
    }

    const serviceRevenueTotal =
      svc.reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction
            .serviceAmount
            .toNumber(),
        0,
      );

    const itemRevenueTotal =
      item.reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction
            .amount
            .toNumber(),
        0,
      );

    const tipsTotal =
      svc.reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction
            .tipAmount
            .toNumber(),
        0,
      );

    const serviceCountTotal =
      svc.reduce(
        (
          total,
          transaction,
        ) =>
          total +
          transaction.lines.reduce(
            (
              lineTotal,
              line,
            ) =>
              lineTotal +
              line.quantity,
            0,
          ),
        0,
      );

    return {
      periodDays:
        days,

      groupBy,

      totals: {
        serviceCount:
          serviceCountTotal,

        serviceRevenue:
          php(
            serviceRevenueTotal,
          ),

        itemRevenue:
          php(
            itemRevenueTotal,
          ),

        tips:
          php(
            tipsTotal,
          ),

        totalCollected:
          php(
            serviceRevenueTotal +
              itemRevenueTotal +
              tipsTotal,
          ),
      },

      series:
        [
          ...buckets.values(),
        ].map(
          (
            bucket,
          ) => ({
            ...bucket,

            serviceRevenue:
              php(
                bucket
                  .serviceRevenue,
              ),

            itemRevenue:
              php(
                bucket
                  .itemRevenue,
              ),

            tips:
              php(
                bucket.tips,
              ),
          }),
        ),

      serviceBreakdown:
        [
          ...serviceBreakdown.values(),
        ]
          .map(
            (
              breakdown,
            ) => ({
              ...breakdown,

              revenue:
                php(
                  breakdown
                    .revenue,
                ),
            }),
          )
          .sort(
            (
              a,
              b,
            ) =>
              b.count -
              a.count,
          ),

      barberBreakdown:
        [
          ...barberBreakdown.values(),
        ]
          .map(
            (
              breakdown,
            ) => ({
              ...breakdown,

              revenue:
                php(
                  breakdown
                    .revenue,
                ),

              tips:
                php(
                  breakdown
                    .tips,
                ),
            }),
          )
          .sort(
            (
              a,
              b,
            ) =>
              b.services -
              a.services,
          ),
    };
  }

  /*
   * ============================================================
   * DASHBOARD
   * ============================================================
   */

  @Get('dashboard')
  @Roles(
    UserRole.ADMIN,
  )
  async dashboard() {
    const today =
      phDate(
        new Date(),
      );

    const data =
      await this.summary(
        '2',
        'daily',
      );

    const todayData =
      data.series.find(
        (row) =>
          row.label ===
          today,
      ) ?? {
        serviceCount:
          0,

        serviceRevenue:
          0,

        itemRevenue:
          0,

        tips:
          0,
      };

    const inventory =
      await this.prisma
        .inventoryItem
        .findMany({
          where: {
            active: true,
          },

          orderBy: {
            name: 'asc',
          },
        });

    const lowItems =
      inventory
        .filter(
          (item) =>
            item
              .quantityOnHand
              .lte(
                item
                  .warningLevel,
              ),
        )
        .map(
          (item) => ({
            id:
              item.id,

            name:
              item.name,

            quantity:
              item
                .quantityOnHand
                .toString(),

            status:
              item
                .quantityOnHand
                .lte(
                  item
                    .reorderLevel,
                )
                ? 'RED'
                : 'YELLOW',
          }),
        );

    return {
      ...todayData,

      totalCollected:
        php(
          Number(
            todayData
              .serviceRevenue,
          ) +
            Number(
              todayData
                .itemRevenue,
            ) +
            Number(
              todayData
                .tips,
            ),
        ),

      lowStockCount:
        lowItems.length,

      lowItems,
    };
  }
}