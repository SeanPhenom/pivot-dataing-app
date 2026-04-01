import{t as p,L as s,r as m,A as n,a,u as t,j as e}from"./index-C2av5ZNl.js";var c=":host{font-family:var(--luzmo-item-option-component-font-family,var(--luzmo-font-family))}.luzmo-item-option{height:var(--luzmo-item-option-component-height,var(--item-option-component-height));justify-content:space-between;align-items:center;gap:var(--luzmo-spacing-3);width:100%;color:var(--luzmo-font-color);font-size:var(--luzmo-font-size-s);display:flex}.control-container{align-items:center;gap:var(--luzmo-item-option-control-container-gap,var(--item-option-control-container-gap));flex:1;justify-content:end;display:flex}.extra-label{padding-left:var(--luzmo-item-option-extra-label-padding-left,var(--item-option-extra-label-padding-left));padding-right:var(--luzmo-item-option-extra-label-padding-right,var(--item-option-extra-label-padding-right));font-size:var(--luzmo-item-option-extra-label-font-size,var(--item-option-extra-label-font-size))}.extra-link{text-align:right;cursor:pointer;text-decoration:underline}.extra-link:hover{color:var(--luzmo-font-color-hover)}.extra-link.disabled{opacity:.65;cursor:not-allowed}.extra-link.disabled:hover{color:var(--luzmo-font-color-disabled)}:host{--item-option-component-height:var(--luzmo-component-height);--item-option-extra-label-padding-right:var(--luzmo-spacing-4);--item-option-extra-label-padding-left:var(--luzmo-spacing-5);--item-option-control-container-gap:var(--luzmo-spacing-2);--item-option-extra-label-font-size:var(--luzmo-font-size-s)}:host([size=s]){--item-option-component-height:var(--luzmo-component-height-s);--item-option-extra-label-padding-right:var(--luzmo-spacing-3);--item-option-extra-label-padding-left:var(--luzmo-spacing-4);--item-option-control-container-gap:var(--luzmo-spacing-2);--item-option-extra-label-font-size:var(--luzmo-font-size-xs)}:host([size=l]){--item-option-component-height:var(--luzmo-component-height-l);--item-option-extra-label-padding-right:var(--luzmo-spacing-4);--item-option-extra-label-padding-left:var(--luzmo-spacing-5);--item-option-control-container-gap:var(--luzmo-spacing-3);--item-option-extra-label-font-size:var(--luzmo-font-size)}:host([size=xl]){--item-option-component-height:var(--luzmo-component-height-xl);--item-option-extra-label-padding-right:var(--luzmo-spacing-5);--item-option-extra-label-padding-left:calc(var(--luzmo-spacing-5) + var(--luzmo-spacing-1));--item-option-control-container-gap:var(--luzmo-spacing-4);--item-option-extra-label-font-size:var(--luzmo-font-size-l)}:host{display:block;overflow:hidden}",i,o=(i=class extends p(s,{defaultSize:"s",validSizes:["s","m","l","xl"]}){constructor(...l){super(...l),this.disabled=!1,this.hideLabel=!1,this.label="",this.tooltip="",this.extraLabel="",this.extraLabelHasClickAction=!1,this.extraLabelTooltip=""}handleExtraLabelClick(l){if(this.extraLabelHasClickAction&&typeof this.extraLabelClickAction=="function"){let{value:r}=this.extraLabelClickAction();this.dispatchEvent(new CustomEvent("luzmo-option-changed",{bubbles:!0,composed:!0,cancelable:!0,detail:{value:r}}))}l.preventDefault(),this.dispatchEvent(new CustomEvent("luzmo-extra-label-click",{bubbles:!0,composed:!0}))}render(){return a`
      <div class="luzmo-item-option">
        ${this.label&&!this.hideLabel?a`
              <luzmo-field-label
                .size=${this.size}
                for="luzmo-item-option-control"
                side-aligned="start"
              >
                ${this.label}
                ${this.tooltip?a`
                      *<luzmo-tooltip
                        self-managed
                        placement="top"
                        size=${this.size}
                      >
                        ${this.tooltip}
                      </luzmo-tooltip>
                    `:n}
              </luzmo-field-label>
            `:n}

        <div class="control-container">
          ${this.extraLabel?a`
                <div
                  class="extra-label ${this.extraLabelHasClickAction?"extra-link":""}"
                  @click=${this.handleExtraLabelClick}
                >
                  <span class=""> ${this.extraLabel} </span>
                </div>
              `:n}
          ${this.renderController()}
        </div>
      </div>
    `}},i.styles=[m(c)],i);t([e({type:Boolean,reflect:!0})],o.prototype,"disabled",void 0),t([e({type:Boolean,reflect:!0,attribute:"hide-label"})],o.prototype,"hideLabel",void 0),t([e({type:String,reflect:!0})],o.prototype,"label",void 0),t([e({type:String,reflect:!0})],o.prototype,"tooltip",void 0),t([e({type:String,attribute:"extra-label"})],o.prototype,"extraLabel",void 0),t([e({type:Boolean,attribute:"extra-label-has-click-action"})],o.prototype,"extraLabelHasClickAction",void 0),t([e()],o.prototype,"extraLabelClickAction",void 0),t([e({type:String,attribute:"extra-label-tooltip"})],o.prototype,"extraLabelTooltip",void 0);export{o as L};
