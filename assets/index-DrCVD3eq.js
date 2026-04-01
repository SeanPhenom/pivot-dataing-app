import{v as S,t as $,E as w,L as F,w as A,r as L,x as z,a,z as i,y as g,B as C,F as v,G as D,H as N,A as f,u as l,j as c,k as u,d as E,I as k}from"./index-Ci7Rlkkf.js";import"./index-D1T0hkKY.js";import"./index-I0k9xCRk.js";import"./index-DiQc5DR4.js";import"./language-resolution-pYd-sAaw-BnTmA2NO.js";var M=":host .settings-container{gap:var(--luzmo-display-settings-vertical-gap,var(--luzmo-spacing-2));flex-direction:column;display:flex}:host .settings-row{justify-content:flex-start;align-items:center;gap:var(--luzmo-display-settings-numeric-gap,var(--display-settings-numeric-gap));display:flex}.duration-angle-down-icon{margin-inline-start:var(--luzmo-numeric-duration-levels-dropdown-icon-margin-inline-start,var(--numeric-duration-levels-dropdown-icon-margin-inline-start))}.dataset-header{white-space:nowrap;text-overflow:ellipsis;text-transform:uppercase;max-width:100%;color:var(--luzmo-font-color);white-space:nowrap;cursor:default;margin:.5rem 1rem;font-weight:600;overflow:hidden}.no-weight-label{margin-left:1rem}.with-secondary-icon{clip-path:polygon(0 0,60% 0,65% 60%,100% 65%,100% 100%,0 100%)}.secondary-icon{width:auto;font-size:.75em;line-height:1;position:absolute;bottom:45%;left:60%}.data-icon-type{text-align:center;width:1.5rem;display:inline-block;position:relative}:host{--display-settings-numeric-gap:var(--luzmo-spacing-3);--numeric-duration-levels-dropdown-icon-margin-inline-start:var(--luzmo-spacing-2)}:host([size=s]){--display-settings-numeric-gap:var(--luzmo-spacing-3);--numeric-duration-levels-dropdown-icon-margin-inline-start:var(--luzmo-spacing-1)}:host([size=l]){--display-settings-numeric-gap:var(--luzmo-spacing-4);--numeric-duration-levels-dropdown-icon-margin-inline-start:var(--luzmo-spacing-3)}:host([size=xl]){--display-settings-numeric-gap:var(--luzmo-spacing-5);--numeric-duration-levels-dropdown-icon-margin-inline-start:var(--luzmo-spacing-4)}";const W={sum:()=>i("Sum",{desc:"Numeric Aggregation option"}),cumulativesum:()=>i("Cumulative sum",{desc:"Numeric Aggregation option"}),average:()=>i("Average",{desc:"Numeric Aggregation option"}),median:()=>i("Median",{desc:"Numeric Aggregation option"}),count:()=>i("Count rows",{desc:"Numeric Aggregation option"}),distinctcount:()=>i("Count distinct",{desc:"Numeric Aggregation option"}),min:()=>i("Minimum",{desc:"Numeric Aggregation option"}),max:()=>i("Maximum",{desc:"Numeric Aggregation option"}),stddev:()=>i("Standard deviation",{desc:"Numeric Aggregation option"}),rate:()=>i("Rate",{desc:"Numeric Aggregation option"})},_={general:"123",percentage:"%",scientific:"SI"},b={time:()=>i("Time",{desc:"Time format option"}),short:()=>i("Short",{desc:"Short format option"}),long:()=>i("Long",{desc:"Long format option"})},y={Auto:{auto:!0,label:()=>i("Auto",{desc:"Automatic setting of the option"})},"1,000.00":{auto:!1,label:()=>"1,000.00",thousandSeparator:",",decimalSeparator:".",hiddenFor:"scientific"},"1.000,00":{auto:!1,label:()=>"1.000,00",thousandSeparator:".",decimalSeparator:",",hiddenFor:"scientific"},"1000.00":{auto:!1,label:()=>"1000.00",decimalSeparator:"."},"1000,00":{auto:!1,label:()=>"1000,00",decimalSeparator:","}},O={levels:[{level:1,label:"years"},{level:2,label:"quarters"},{level:3,label:"months"},{level:4,label:"weeks"},{level:5,label:"days"},{level:6,label:"hours"},{level:7,label:"minutes"},{level:8,label:"seconds"},{level:9,label:"milliseconds"}]};var s=class extends S($(F,{validSizes:Object.values(w)})){constructor(...t){super(...t),this.slotContent={},this.measureColumns=[],this._durationLevels=[],this._renderDurationLevelMenu=!1,this._handleSlottableRequest=e=>{this._renderDurationLevelMenu=e.data!==A},this._sendEvent=()=>{let e={...this.slotContent,format:this._format,aggregationFunc:this._aggregationFunc};this._aggregationWeightColumn?e.aggregationWeight={...this._aggregationWeightColumn}:delete e.aggregationWeight,this._displayMode==="duration"?(e.duration=e.duration??{},e.duration.format=this._durationFormat,e.duration.levels=this._durationLevels):delete e.duration,this.dispatchEvent(new CustomEvent("luzmo-slot-content-changed",{bubbles:!0,composed:!0,cancelable:!0,detail:{slotContent:e}}))}}static get styles(){return[L(M)]}_parseSavedNumericFormatSettings(){if(this._displayMode=this.slotContent?.subtype==="duration"?"duration":"numeric",this._durationFormat=this.slotContent?.duration?.format??"short",this._durationLevels=this.slotContent?.duration?.levels??[1],this._displayMode==="duration")this._precision=2,this._commaDecimals=!1,this._thousandSeparator=!1;else{this._format=this.slotContent?.format??".0f";let t=z(this._format??".0f");this._isAuto=t.typeFormat?.includes("a")??!1,["%","a%","y","ay"].includes(t.typeFormat)?this._displayAs="percentage":["s","as","w","aw"].includes(t.typeFormat)?this._displayAs="scientific":this._displayAs="general",this._precision=t.precision?Number.parseInt(t.precision.replace(".",""),10):this._displayAs==="scientific"?1:0,this._commaDecimals=["z","az","y","ay","w","aw"].includes(t.typeFormat),this._thousandSeparator=t.comma===",",this._isAuto?this._numericFormatGroup="Auto":this._commaDecimals&&this._thousandSeparator?this._numericFormatGroup="1.000,00":!this._commaDecimals&&this._thousandSeparator?this._numericFormatGroup="1,000.00":this._commaDecimals&&!this._thousandSeparator?this._numericFormatGroup="1000,00":!this._commaDecimals&&!this._thousandSeparator&&(this._numericFormatGroup="1000.00")}}_setNumericDisplayAs(){this._displayAs=this._displayAsElement?.selected?.[0]??"general",this._displayAs==="scientific"&&(this._precision=Math.max(this._precision??0,1),this._thousandSeparator=!1),this._setNumericFormat(),this._sendEvent(),this.requestUpdate()}_setNumericSeparators(t){let e=y[t?.detail??"Auto"];this._thousandSeparator=[",","."].includes(e?.thousandSeparator??""),this._commaDecimals=e?.decimalSeparator===",",this._isAuto=e?.auto,this._setNumericFormat(),this._sendEvent()}_setPrecision(){Number.isNaN(this._precisionElement.value)&&(this._precisionElement.value=this._displayAs==="scientific"?1:0),this._precision=this._precisionElement.value,this._setNumericFormat(),this._sendEvent()}_setNumericFormat(){let t="f",e=this.slotContent.subtype==="duration"?this._durationLevels&&this._durationLevels?.length===1?"numeric":"duration":"numeric";if(this._maxDurationLevel=Math.min(...this._durationLevels),e==="duration")(!["time","short","long"].includes(this._durationFormat??"")||this._maxDurationLevel<6&&this._durationFormat==="time")&&(this._durationFormat="short");else{let o=this._displayAs??"general";o==="general"&&this._commaDecimals?t="z":o==="percentage"&&this._commaDecimals?t="y":o==="scientific"&&this._commaDecimals?t="w":o==="percentage"?t="%":o==="scientific"&&(t="s"),this._format=(this._thousandSeparator||this._isAuto?",":"")+"."+this._precision+(this._isAuto?"a":"")+t}}_setAggregationFunc(){let t=this._aggregationElement.value,e=this._aggregationFunc,o=this.slotContent.format;if(t!==(e==="weightedaverage"?"average":e)){if(this._aggregationFunc=t==="average"&&this._aggregationWeightColumn?.column?"weightedaverage":t,e==="rate"){let n=z(o),r=["%","y","a%","ay"].includes(n.typeFormat);this.slotContent.subtype==="currency"&&r&&this._setNumericDisplayAs()}this._sendEvent(),(this._aggregationFunc==="rate"||e==="rate")&&this.requestUpdate()}}_setAggregationWeight(){let t=this._aggregationWeightElement.value,e=this._aggregationFunc;if(t==="none")this._aggregationWeightColumn=void 0,this._aggregationFunc==="weightedaverage"&&(this._aggregationFunc="average");else{let o,n;for(let r of this.measureColumns??[]){let m=r.columns?.find(d=>d.id===t);if(m){o=m,n=r.datasetId;break}}o&&(this._aggregationWeightColumn={column:o.id,set:n,columnSubType:o.subtype}),this._aggregationFunc==="average"&&(this._aggregationFunc="weightedaverage")}this._sendEvent(),this.requestUpdate(),(e==="weightedaverage"&&this._aggregationFunc==="average"||e==="average"&&this._aggregationFunc==="weightedaverage")&&this.requestUpdate()}_setDurationLevels(){let t=this._durationLevels,e=this._durationLevelsElement.value.split(",").filter(o=>o!=="").map(o=>Number.parseInt(o,10));this._durationLevels=(e?.length??0)>=1?e:t,this._maxDurationLevel=Math.min(...this._durationLevels),this._fillTimeDurationLevels(),this._setNumericFormat(),this._sendEvent(),this.requestUpdate()}_setDurationFormat(){this._durationFormat=this._durationFormatElement?.selected?.[0],this._fillTimeDurationLevels(),this._setNumericFormat(),this._sendEvent(),this.requestUpdate()}_fillTimeDurationLevels(){if(this._durationFormat==="time"){let t=this._durationLevels.sort().at(-1);if([7,8,9].includes(t)){for(let e of{lev7:[6],lev8:[6,7],lev9:[6,7,8]}["lev"+t])this._durationLevels.includes(e)||this._durationLevels.push(e);this._durationLevels=[...this._durationLevels].sort()}}}willUpdate(t){super.willUpdate(t),t.has("slotContent")&&(this._parseSavedNumericFormatSettings(),this._aggregationFunc=this.slotContent?.aggregationFunc??(this.slotContent?.type==="numeric"?"sum":"count"),this._aggregationWeightColumn=this.slotContent?.aggregationWeight,this._isFormula=this.slotContent?.formula||this.slotContent?.formulaId)}_renderDurationLevelsSettings(){let t=O.levels.map(e=>{let o=!1;return this._durationFormat==="time"&&e.level>=6&&this._durationLevels.includes(e.level)&&e.level!==Math.max(...this._durationLevels)&&(o=!0),this._durationLevels.length===1&&this._durationLevels.includes(e.level)&&(o=!0),a`<luzmo-menu-item
        value=${e.level}
        ?selected=${this._durationLevels.includes(e.level)}
        ?disabled=${o}
      >
        ${e.label}
      </luzmo-menu-item>`});return a` <div class="setting">
      <luzmo-field-label for="duration-levels">
        ${i("Duration levels",{desc:"Label for duration levels setting"})}
      </luzmo-field-label>
      <luzmo-action-button id="duration-levels-trigger" size=${this.size}>
        ${this._durationLevels.length}
        ${this._durationLevels.length===1?"level":"levels"} active
        <span class="duration-angle-down-icon">
          ${g(C)}
        </span>
      </luzmo-action-button>
      <luzmo-overlay
        id="duration-levels-overlay"
        trigger="duration-levels-trigger@click"
        type="auto"
        placement="bottom-start"
        type="page"
        @slottable-request=${this._handleSlottableRequest}
      >
        <luzmo-popover style="position: relative">
          ${this._renderDurationLevelMenu?a` <luzmo-menu
                id="duration-levels"
                size=${this.size}
                selects="multiple"
                .value=${this._durationLevels.join(",")}
                @change=${this._setDurationLevels}
              >
                ${t}
              </luzmo-menu>`:""}
        </luzmo-popover>
      </luzmo-overlay>
    </div>`}_renderDurationFormatSettings(){let t=Object.keys(b).map(e=>e==="time"&&(this._maxDurationLevel??1)<6?"":a`<luzmo-action-button value=${e}>
        ${b[e]()}
      </luzmo-action-button>`);return a` <div class="setting">
      <luzmo-field-label for="duration-format">
        ${i("Format",{desc:"Label for format setting"})}
      </luzmo-field-label>
      <luzmo-action-group
        emphasized
        id="duration-format"
        size=${this.size}
        compact=""
        .selected=${[this._durationFormat??"short"]}
        selects="single"
        @change=${this._setDurationFormat}
      >
        ${t}
      </luzmo-action-group>
    </div>`}_renderNumericDisplayAsSettings(){let t=Object.keys(_).filter(e=>e!=="percentage"||(this.slotContent.subtype!=="currency"||this.slotContent.aggregationFunc==="rate")&&this.slotContent.periodOverPeriod?.type!=="percentageChange").map(e=>a`<luzmo-action-button value=${e}
            >${_[e]}</luzmo-action-button
          >`);return a`<div class="setting">
      <luzmo-field-label for="display-as">
        ${i("Display as",{desc:"Label for display as setting for the datetime field"})}
      </luzmo-field-label>
      <luzmo-action-group
        emphasized
        id="display-as"
        size=${this.size}
        compact=""
        .selected=${[this._displayAs]}
        selects="single"
        @change=${this._setNumericDisplayAs}
      >
        ${t}
      </luzmo-action-group>
    </div>`}_renderNumericFormatSettings(){let t=Object.entries(y).filter(([,{hiddenFor:e}])=>!e||e!==this._displayAs).map(([e,{label:o}])=>a`<luzmo-menu-item value=${e}>${o()}</luzmo-menu-item>`);return a` <div class="setting">
        <luzmo-field-label for="format">
          ${i("Format",{desc:"Label for format setting"})}
        </luzmo-field-label>
        <luzmo-picker
          id="format"
          size=${this.size}
          variant="highlight"
          value=${this._numericFormatGroup??"Auto"}
          @change=${this._setNumericSeparators}
        >
          ${t}
        </luzmo-picker>
      </div>
      <div class="setting">
        <luzmo-field-label for="precision" id="precision-label">
          ${this._displayAs==="scientific"?i("Precision",{desc:"Label for precision setting"}):i("Decimals",{desc:"Label for decimals setting"})}
        </luzmo-field-label>
        <luzmo-number-field
          id="precision"
          min=${this._displayAs==="scientific"?1:0}
          max="22"
          size=${this.size}
          value=${this._precision??(this._displayAs==="scientific"?1:0)}
          @change=${this._setPrecision}
        ></luzmo-number-field>
      </div>`}_renderAggregationSettings(){let t=Object.entries(W).filter(([o])=>["count","distinctcount"].includes(o)||this.slotContent?.type==="numeric").filter(([o])=>o!=="cumulativesum"||this.isCumulativeSumEnabled).map(([o,n])=>a`<luzmo-menu-item value=${o}>${n()}</luzmo-menu-item>`),e=[a`
        <luzmo-menu-item
          value="none"
          class="no-weight"
        >
          <span class="no-weight-label">No weight</span>
        </luzmo-menu-item>
      `,...(this.measureColumns??[]).flatMap(o=>{let n=typeof o.datasetName=="object"?v(o.datasetName,this.language):o.datasetName;return[a`<div class="dataset-header">
          ${n}
          <luzmo-tooltip self-managed placement="right" size=${this.size}>
            ${n}
          </luzmo-tooltip>
        </div>`,...(o.columns??[]).map(r=>{let m=typeof r.name=="object"?v(r.name,this.language):r.name,d=g(D(r,"s")),h=r.expression?N:void 0,p=!!h,x=p?a`<span class="secondary-icon"
                >${g(h)}</span
              >`:f;return a`<luzmo-menu-item value=${r.id}>
            <span class="data-icon-type" slot="icon">
              <span class=${p?"with-secondary-icon":""}
                >${d}</span
              >
              ${x}
            </span>
            <span class="column-label text-truncate">${m}</span>
            <luzmo-tooltip self-managed placement="right" size=${this.size}>
              ${m}
            </luzmo-tooltip>
          </luzmo-menu-item>`})]})];return a`<div class="settings-row">
      <div class="setting">
        <luzmo-field-label for="aggregation">
          ${i("Aggregation",{desc:"Label for aggregation setting"})}
        </luzmo-field-label>
        <luzmo-picker
          id="aggregation"
          size=${this.size}
          variant="highlight"
          value=${(()=>{let o=this.slotContent?.type==="numeric"?"sum":"count";return this._aggregationFunc==="weightedaverage"?"average":this._aggregationFunc??o})()}
          @change=${this._setAggregationFunc}
        >
          ${t}
        </luzmo-picker>
      </div>
      ${["rate","average","weightedaverage"].includes(this._aggregationFunc??"")?a`<div class="setting">
            <luzmo-field-label for="weighting-column">
              ${this._aggregationFunc==="rate"?"Denominator":"Weight"}
            </luzmo-field-label>
            ${this.measureColumns.length>0?a`
                  <luzmo-picker
                    id="weighting-column"
                    size=${this.size}
                    variant="highlight"
                    icons="none"
                    value=${this._aggregationWeightColumn?.column??"none"}
                    @change=${this._setAggregationWeight}
                  >
                    ${e}
                  </luzmo-picker>
                `:a`<luzmo-picker
                  id="weighting-column"
                  size=${this.size}
                  variant="highlight"
                  icons="none"
                  value="none"
                >
                  <luzmo-menu-item value="none">No weight</luzmo-menu-item>
                </luzmo-picker>`}
          </div>`:""}
    </div>`}render(){return a`<div class="settings-container">
      <div class="settings-row">
      ${this._displayMode==="duration"?this._renderDurationLevelsSettings():this._renderNumericDisplayAsSettings()}
      ${this._durationLevels?.length>1?this._renderDurationFormatSettings():this._renderNumericFormatSettings()}
      </div>
      ${this._isFormula||this.isAggregationDisabled?f:this._renderAggregationSettings()}
      </div>
    </div>`}};l([c({type:Object,attribute:!1})],s.prototype,"slotContent",void 0),l([c({type:Array,reflect:!1})],s.prototype,"measureColumns",void 0),l([c({type:Boolean})],s.prototype,"isAggregationDisabled",void 0),l([c({type:Boolean})],s.prototype,"isCumulativeSumEnabled",void 0),l([u("#display-as")],s.prototype,"_displayAsElement",void 0),l([u("#precision")],s.prototype,"_precisionElement",void 0),l([u("#aggregation")],s.prototype,"_aggregationElement",void 0),l([u("#weighting-column")],s.prototype,"_aggregationWeightElement",void 0),l([u("#duration-levels")],s.prototype,"_durationLevelsElement",void 0),l([u("#duration-format")],s.prototype,"_durationFormatElement",void 0),l([E()],s.prototype,"_renderDurationLevelMenu",void 0),s=l([k()],s),customElements.get("luzmo-display-settings-numeric")||customElements.define("luzmo-display-settings-numeric",s);(function(){if(typeof document<"u"&&!document.querySelector("style[data-luzmo-vars]")){let t=document.createElement("style");t.setAttribute("data-luzmo-vars",""),t.textContent="html{--luzmo-animation-duration: 0.15s;--luzmo-border-color: rgba(var(--luzmo-border-color-rgb), 0.1);--luzmo-border-color-hover: rgba(var(--luzmo-border-color-rgb), 0.15);--luzmo-border-color-down: rgba(var(--luzmo-border-color-rgb), 0.3);--luzmo-border-color-focus: rgba(var(--luzmo-border-color-rgb), 0.15);--luzmo-border-color-rgb: 0, 0, 0;--luzmo-border-color-full: rgb(180, 180, 180);--luzmo-border-color-full-hover: rgb(140, 140, 140);--luzmo-border-color-full-down: rgb(110, 110, 110);--luzmo-border-color-full-focus: rgb(140, 140, 140);--luzmo-border-color-disabled: #dddddd;--luzmo-border-radius: 6px;--luzmo-border-radius-s: 4px;--luzmo-border-radius-l: 8px;--luzmo-border-radius-xl: 12px;--luzmo-border-radius-full: 999rem;--luzmo-background-color: #ffffff;--luzmo-background-color-rgb: 255, 255, 255;--luzmo-background-color-disabled: #eeeeee;--luzmo-background-color-hover: #f0f0fc;--luzmo-background-color-down: #f1f1ff;--luzmo-background-color-focus: #f0f0fc;--luzmo-background-color-highlight: rgb(240, 240, 240);--luzmo-background-color-highlight-disabled: rgb(245, 245, 245);--luzmo-background-color-highlight-hover: rgb(225, 225, 225);--luzmo-background-color-highlight-down: rgb(215, 215, 215);--luzmo-background-color-highlight-focus: rgb(225, 225, 225);--luzmo-background-color-alt-1: rgb(250, 250, 250);--luzmo-background-color-alt-2: rgb(239, 239, 239);--luzmo-border-width: 1px;--luzmo-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, sans-serif;--luzmo-font-size-xs: 10px;--luzmo-font-size-s: 12px;--luzmo-font-size-m: 14px;--luzmo-font-size: 14px;--luzmo-font-size-l: 16px;--luzmo-font-size-xl: 18px;--luzmo-font-size-xxl: 20px;--luzmo-font-style: normal;--luzmo-line-height: normal;--luzmo-font-weight: 400;--luzmo-font-weight-semibold: 500;--luzmo-font-weight-bold: 600;--luzmo-font-color: #333;--luzmo-font-color-hard: #000;--luzmo-font-color-disabled: var(--luzmo-color-disabled);--luzmo-font-color-extra-dimmed: #888;--luzmo-font-color-hover: #333;--luzmo-font-color-down: #111;--luzmo-font-color-focus: #333;--luzmo-scrollbar-size: 6px;--luzmo-scrollbar-width: thin;--luzmo-scrollbar-track-background: transparent;--luzmo-scrollbar-track-border-radius: var(--luzmo-border-radius-s);--luzmo-scrollbar-thumb-background: rgba(var(--luzmo-border-color-rgb), 0.3);--luzmo-scrollbar-thumb-border-radius: var(--luzmo-border-radius-s);--luzmo-scrollbar-thumb-hover-background: rgba(var(--luzmo-border-color-rgb), 0.4);--luzmo-primary: #4434ff;--luzmo-primary-hover: #4234e4;--luzmo-primary-down: #392cc7;--luzmo-primary-focus: #4234e4;--luzmo-primary-inverse-color: #ffffff;--luzmo-primary-rgb: 68, 52, 255;--luzmo-secondary: #ff00ff;--luzmo-secondary-hover: #e309e3;--luzmo-secondary-down: #c711c7;--luzmo-secondary-focus: #e309e3;--luzmo-secondary-inverse-color: #ffffff;--luzmo-secondary-rgb: 255, 0, 255;--luzmo-secondary-outline: rgba(255, 0, 255, 0.2);--luzmo-negative-color: #ca221c;--luzmo-negative-color-hover: #b3241f;--luzmo-negative-color-down: #9f231f;--luzmo-negative-color-focus: #b3241f;--luzmo-negative-color-rgb: 202, 34, 28;--luzmo-positive-color: rgb(20, 150, 101);--luzmo-positive-color-hover: rgb(17, 128, 86);--luzmo-positive-color-down: rgb(16, 105, 71);--luzmo-positive-color-focus: rgb(17, 128, 86);--luzmo-positive-color-rgb: 20, 150, 101;--luzmo-selected-color: rgb(110, 110, 110);--luzmo-selected-color-hover: rgb(70, 70, 70);--luzmo-selected-color-down: rgb(40, 40, 40);--luzmo-selected-color-focus: rgb(70, 70, 70);--luzmo-selected-color-hard: #1e1e1e;--luzmo-selected-color-hard-hover: rgb(0, 0, 0);--luzmo-selected-color-hard-down: rgb(0, 0, 0);--luzmo-selected-color-hard-focus: rgb(0, 0, 0);--luzmo-color-informative: #1a77e9;--luzmo-color-informative-rgb: 26, 119, 233;--luzmo-color-disabled: #aaaaaa;--luzmo-spacing-1: 2px;--luzmo-spacing-2: 4px;--luzmo-spacing-3: 8px;--luzmo-spacing-4: 12px;--luzmo-spacing-5: 16px;--luzmo-indicator-gap: 2px;--luzmo-indicator-width: 1px;--luzmo-indicator-color: var(--luzmo-primary);--luzmo-component-height-xxs: 20px;--luzmo-component-height-xs: 24px;--luzmo-component-height-s: 28px;--luzmo-component-height: 32px;--luzmo-component-height-l: 40px;--luzmo-component-height-xl: 48px;--luzmo-component-height-xxl: 64px;--luzmo-icon-size-xxs: 12px;--luzmo-icon-size-xs: 14px;--luzmo-icon-size-s: 16px;--luzmo-icon-size-m: 18px;--luzmo-icon-size-l: 20px;--luzmo-icon-size-xl: 22px;--luzmo-icon-size-xxl: 32px}",document.head.appendChild(t)}})();export{s as LuzmoDisplaySettingsNumeric};
