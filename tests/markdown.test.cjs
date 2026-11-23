const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const browser = vm.createContext({ URL });
browser.window = browser;
for (const file of ['assets/vendor/marked.umd.js', 'markdown.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), browser, { filename: file });
}
const { render } = browser.AgentMarkdown;

const markdown = [
  '## 整理结果',
  '',
  '| 事项 | 负责人 |',
  '| --- | --- |',
  '| 核对 | 待确认 |',
  '',
  '- [x] **已核对**',
  '',
  '```html',
  '<b>示例</b>',
  '```'
].join('\n');
const html = render(markdown);
assert.match(html, /<h2>整理结果<\/h2>/);
assert.match(html, /<div class="markdown-table"[^>]*><table>/);
assert.match(html, /<td>待确认<\/td>/);
assert.match(html, /<input [^>]*disabled=""[^>]*type="checkbox"> <strong>已核对<\/strong>/);
assert.match(html, /<pre><code class="language-html">&lt;b&gt;示例&lt;\/b&gt;/);
assert.equal(render('第一行\n第二行'), '<p>第一行<br>第二行</p>\n');
assert.equal(render(''), '');

assert.match(render('文字 <b>粗体</b>。'), /文字 &lt;b&gt;粗体&lt;\/b&gt;。/);
assert.match(render('<div>文字</div>'), /&lt;div&gt;文字&lt;\/div&gt;/);
assert.match(render('文字 <code>用量 &copy; 约定</code>'), /&lt;code&gt;用量 &amp;copy; 约定&lt;\/code&gt;/);
assert.match(render('[来源](https://example.com/?a=1&b=2)'), /href="https:\/\/example\.com\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"/);
assert.equal(render('[历史](/history) [邮箱](mailto:help@example.com)'), '<p>历史 邮箱</p>\n');
const image = render('![示意图](https://example.com/diagram.png)');
assert.match(image, /<a href="https:\/\/example\.com\/diagram\.png"[^>]*>示意图<\/a>/);
assert.doesNotMatch(image, /<img/);

console.log('Markdown renderer checks passed.');
