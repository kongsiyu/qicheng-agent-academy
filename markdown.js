(function (root) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = value => value.replace(/[&<>"']/g, char => entities[char]);

  function externalLink(href, label, title) {
    if (!/^https?:\/\//i.test(href)) return label;
    let url;
    try {
      url = new URL(href);
    } catch {
      return label;
    }
    const titleAttr = title ? ` title="${escape(title)}"` : '';
    return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
  }

  const parser = new root.marked.Marked({
    gfm: true,
    breaks: true,
    renderer: {
      html({ text, block }) {
        return block ? `<pre>${escape(text)}</pre>\n` : escape(text);
      },
      text(token) {
        // Marked can mark inline text inside raw HTML as already escaped.
        return token.escaped ? escape(token.text) : false;
      },
      link({ href, text, title, tokens, autolink }) {
        const label = autolink ? escape(text) : this.parser.parseInline(tokens);
        return externalLink(href, label, title);
      },
      image({ href, text, title, tokens }) {
        // Keep remote images available as explicit links in the local preview.
        const label = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
        return externalLink(href, escape(label || '图片'), title);
      },
      table(token) {
        const table = root.marked.Renderer.prototype.table.call(this, token);
        return `<div class="markdown-table" tabindex="0">${table}</div>\n`;
      }
    }
  });

  root.AgentMarkdown = {
    render(text) {
      if (!text) return '';
      try {
        return parser.parse(text);
      } catch {
        return `<pre>${escape(text)}</pre>`;
      }
    }
  };
})(window);
