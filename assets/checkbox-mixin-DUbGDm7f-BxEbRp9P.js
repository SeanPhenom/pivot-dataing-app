import{j as s,k as a,p as d,a as l}from"./index-C2av5ZNl.js";var p=Object.defineProperty,c=(n,e,h,i)=>{for(var t=void 0,r=n.length-1,o;r>=0;r--)(o=n[r])&&(t=o(e,h,t)||t);return t&&p(e,h,t),t};function y(n){let e=class extends n{constructor(){super(...arguments),this.checked=!1,this.readonly=!1}handleChange(){if(this.readonly){this.inputElement.checked=this.checked;return}this.checked=this.inputElement.checked;const i=new CustomEvent("change",{bubbles:!0,cancelable:!0,composed:!0,detail:this.checked});this.dispatchEvent(i)||(this.checked=!this.inputElement.checked,this.inputElement.checked=this.checked)}render(){return l`
        <input
          id="input"
          name=${d(this.name||void 0)}
          type="checkbox"
          .checked=${this.checked}
          ?disabled=${this.readonly}
          @change=${this.handleChange}
        />
      `}};return c([s({type:Boolean,reflect:!0})],e.prototype,"checked"),c([s({type:String,reflect:!0})],e.prototype,"name"),c([s({type:Boolean,reflect:!0})],e.prototype,"readonly"),c([a("#input")],e.prototype,"inputElement"),e}export{y};
