import { ArrowUpRight, Crosshair, Eye, Info } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { format, type Metric, type Player, type Stats } from '@/lib/stats';
import type { Slot } from '@/lib/slot-store';

type Props = {
  isManual: boolean; anyData: boolean; comp: boolean; arenaActive: boolean; ratingMismatch: boolean;
  showAllStats: boolean; setShowAllStats: (value: boolean) => void; showDemo: () => void;
  tableMetrics: Metric[]; visibleTableMetrics: Metric[];
  a: Slot; b: Slot; pa: Player | undefined; pb: Player | undefined; sa: Stats; sb: Stats;
  primaryColor: string; secondaryColor: string;
};
export function RadarDataTable({ isManual, anyData, comp, arenaActive, ratingMismatch, showAllStats,
  setShowAllStats, showDemo, tableMetrics, visibleTableMetrics, a, b, pa, pb, sa, sb, primaryColor, secondaryColor }: Props) {
  return (
<section
          className={'data-section' + (isManual ? ' manual-data-section' : '')}
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE NUMBERS</div>
              <h2>原始数据</h2>
            </div>
            <div className="section-heading-actions">
              <span className="muted small">
                {isManual ? '“暂无”表示尚未填写' : '“暂无”表示来源未提供'}
              </span>
              {anyData && tableMetrics.length > visibleTableMetrics.length && (
                <button
                  className="button secondary compact-button"
                  type="button"
                  onClick={() => setShowAllStats(true)}
                >
                  <Eye size={15} />
                  查看全部 {tableMetrics.length} 项
                </button>
              )}
              {anyData && showAllStats && (
                <button
                  className="button secondary compact-button"
                  type="button"
                  onClick={() => setShowAllStats(false)}
                >
                  收起数据
                </button>
              )}
            </div>
          </div>
          {anyData ? (
            <Table className="stats-table">
              <TableHeader>
                <TableRow>
                  <TableHead>数据指标</TableHead>
                  <TableHead className="text-a" style={{ color: primaryColor }}>
                    A · {pa?.name || '未选择'}
                    <small>
                      {a.data?.scopes.find((x) => x.id === a.scopeId)?.name}
                    </small>
                  </TableHead>
                  {comp && (
                    <TableHead
                      className="text-b"
                      style={{ color: secondaryColor }}
                    >
                      B · {pb?.name || '未选择'}
                      <small>
                        {b.data?.scopes.find((x) => x.id === b.scopeId)?.name}
                      </small>
                    </TableHead>
                  )}
                  {comp && <TableHead>差值 A − B</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTableMetrics.map((m) => {
                  const av = sa[m.key],
                    bv = sb[m.key],
                    delta =
                      av !== undefined && bv !== undefined
                        ? av - bv
                        : undefined,
                    noDelta = m.key === 'rating' && ratingMismatch;
                  return (
                    <TableRow key={m.key}>
                      <TableCell>
                        <div className="metric-name">
                          <b>{m.label}</b>
                          <span>{m.name}</span>
                          <Tooltip>
                            <TooltipTrigger
                              className="info-button"
                              aria-label={m.label + '说明'}
                            >
                              <Info size={14} />
                            </TooltipTrigger>
                            <TooltipContent className="metric-tooltip">
                              {arenaActive && m.key === 'rating' ? 'Local Arena 离线评分模型，与 HLTV 官方 Rating 不同。' : m.description}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell
                        className="numeric text-a"
                        style={{ color: primaryColor }}
                      >
                        {format(av, m)}
                      </TableCell>
                      {comp && (
                        <TableCell
                          className="numeric text-b"
                          style={{ color: secondaryColor }}
                        >
                          {format(bv, m)}
                        </TableCell>
                      )}
                      {comp && (
                        <TableCell className="numeric muted">
                          {noDelta
                            ? '版本不可比'
                            : delta === undefined
                              ? '暂无'
                              : (delta > 0 ? '+' : '') +
                                delta.toFixed(m.decimals) +
                                (m.unit === '%' ? ' 个百分点' : '')}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="table-empty">
              <div className="empty-grid-icon">
                <Crosshair size={22} />
              </div>
              <p>导入数据后，Rating、ADR、KAST 与火力值将在这里展示。</p>
              <button className="text-button" onClick={showDemo}>
                使用虚构示例体验图表 <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </section>
  );
}
