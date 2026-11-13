// Synthetic regression page based on the supplied event screenshot, not a
// downloaded HLTV document. The rating gauge is separate from the stat cards.
export function playerRatingPage({rating='0.91',version='3.0',extra=''}={}) {
  const card=(label,value)=>`<div class="player-summary-stat-box-data-wrapper"><div class="player-summary-stat-box-data traditionalData">${value}</div><div class="player-summary-stat-box-data-text traditionalData">${label}</div></div>`;
  return `<div class="summaryNickname">ZywOo</div>
    <div class="player-summary-stat-box">
      <div><div>0.73</div><div>T Rating</div></div>
      <div class="rating-gauge">
        <svg><path d="M 0 0"/></svg>
        <div class="rating-result"><span>Poor</span><div><b>${rating}</b></div></div>
        <div class="rating-caption"><span>Rating <span>${version}</span><div class="player-summary-tooltip"><b>Rating ${version}</b><br>The average is 1.00.</div></span></div>
      </div>
      <div><div>1.11</div><div>CT Rating</div></div>
    </div>${extra}
    ${card('KPR','0.61')}${card('DPR','0.66')}${card('ADR','62.8')}
    ${card('KAST','70.9%')}${card('Multi-kill','14.6%')}${card('Round swing','-0.93%')}
    <div data-attribute="firepower" data-value="21"></div>`;
}
