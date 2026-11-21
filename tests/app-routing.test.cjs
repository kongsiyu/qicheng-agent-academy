const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function boot(hash) {
  const nodes = new Map(), documentEvents = {}, windowEvents = {}, store = new Map(), calls = [], files = [];
  const element = key => {
    if (!nodes.has(key)) nodes.set(key,{
      innerHTML:'',textContent:'',hidden:false,open:false,value:'',dataset:{},
      addEventListener(){},focus(){},select(){},click(){},remove(){},scrollIntoView(){},
      showModal(){this.open=true;},close(){this.open=false;},matches(){return false;},
      querySelector:selector=>element(selector),querySelectorAll:()=>[]
    });
    return nodes.get(key);
  };
  let appContext;
  const sandbox={
    Intl,Date,Blob,console,setTimeout:()=>1,clearTimeout(){},navigator:{},
    location:{hash,protocol:'http:'},
    history:{replaceState(_a,_b,value){sandbox.location.hash=value;}},
    URL:{createObjectURL(blob){files.push(blob);return 'blob:test';},revokeObjectURL(){}},
    document:{
      title:'',activeElement:null,querySelector:element,querySelectorAll:()=>[],
      createElement:()=>element('download'),
      addEventListener(type,handler){(documentEvents[type] ||= []).push(handler);}
    },
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
    addEventListener(type,handler){(windowEvents[type] ||= []).push(handler);},scrollTo(){},
    createProjectUI(ctx){
      appContext=ctx;
      return {
        openLegacy(id){calls.push(['legacy',id]);element('#main').innerHTML='<section>逐步练习</section>';},
        render(tab){calls.push(['project',tab]);element('#main').innerHTML='<section>逐步项目</section>';},
        checkpoint(){},weekCard:()=>'',dashboard:()=>'',skillCards:()=>''
      };
    }
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  for(const name of ['content.js','curriculum.js','quality-core.js','core.js']) vm.runInContext(source(name),sandbox,{filename:name});
  vm.runInContext(`
    var initial = AgentLearningCore.createState(AgentCourseContent);
    initial.tasks.meeting.mode='practice';
    initial.tasks.meeting.input='原始会议资料，日期和责任人尚有待确认的内容。';
    initial.tasks.meeting.output='旧成果完整原文，不能因切换入口丢失。<script>不执行</script>';
    initial.tasks.meeting.notes='原来的复盘与修改依据也应保留。';
    initial.tasks.meeting.checks['meeting-c1']=true;
    initial.learning.draft.input='当前另一份正式练习草稿，不能被旧任务入口直接覆盖。';
    initial.learning.draft.output='当前草稿实际成果也不能因导航而被清空。';
    localStorage.setItem('qicheng.agent-academy.v1',JSON.stringify(initial));
  `,sandbox);
  vm.runInContext(source('app.js'),sandbox,{filename:'app.js'});
  return {
    sandbox,calls,files,nodes,context:()=>appContext,
    state:()=>appContext.getState(),
    render(route){sandbox.location.hash=route;for(const handler of windowEvents.hashchange||[])handler();},
    storage(value){for(const handler of windowEvents.storage||[])handler({key:'qicheng.agent-academy.v1',newValue:JSON.stringify(value)});},
    async click(action,id='meeting'){for(const handler of documentEvents.click||[])await handler({target:{closest:()=>({dataset:{action,id,mode:'practice',step:'2',index:'0'}})}});},
    async input(target){for(const handler of documentEvents.input||[])await handler({target});},
    async change(target){for(const handler of documentEvents.change||[])await handler({target});}
  };
}

(async()=>{
  for(const id of ['meeting','research','spreadsheet','knowledge','review','weekly']){
    const app=boot('#/task/'+id);
    assert.deepEqual(app.calls,[['legacy',id]],'bookmarked task routes delegate to the protected step flow');
    assert.equal(app.nodes.get('#main').innerHTML,'<section>逐步练习</section>');
    assert.match(app.nodes.get('#sidebar-progress').innerHTML,/先完成一次练习/,'legacy entry uses the same low-pressure sidebar');
    assert.match(app.nodes.get('#breadcrumb').innerHTML,/动手练习/);
    assert.equal(app.state().learning.draft.input,'当前另一份正式练习草稿，不能被旧任务入口直接覆盖。');
    assert.match(app.state().tasks.meeting.output,/旧成果完整原文/);
  }
  const app=boot('#/artifacts'), before=JSON.stringify(app.state());
  const page=app.nodes.get('#main').innerHTML;
  assert.match(page,/查看原记录/);
  assert.match(page,/原来的复盘与修改依据也应保留/);
  assert.match(page,/&lt;script&gt;不执行&lt;\/script&gt;/,'original text is displayed without executing markup');
  assert.match(page,/data-project-action="legacy-task" data-task="meeting"/,'continue delegates to the protected legacy import');
  assert.match(page,/data-action="download-artifact"/,'original record remains downloadable');
  assert.equal(page.includes('href="#/task/'),false,'history no longer points back to a separate editor');
  assert.equal(page.includes('<textarea'),false,'history is read-only until the protected step flow is opened');

  for(const action of ['task-mode','task-step','task-complete','save-draft','challenge'])await app.click(action);
  await app.input({id:'old-input',dataset:{id:'meeting',taskField:'input'},value:'过期页面不能改写旧资料'});
  await app.change({id:'old-check',dataset:{id:'meeting',taskCheck:'meeting-c1'},checked:false});
  await app.change({id:'old-upload',dataset:{taskUpload:'meeting'},files:[{name:'old.txt',size:10,text:async()=> '过期页面不能写入'}]});
  assert.equal(JSON.stringify(app.state()),before,'retired task editor actions cannot modify records or the active draft');
  await app.click('download-artifact');
  assert.equal(app.files.length,1);
  const exported=await app.files[0].text();
  for(const text of ['原始会议资料','旧成果完整原文','原来的复盘','[x]'])assert.ok(exported.includes(text));
  assert.equal(JSON.stringify(app.state()),before,'export is read-only');
  app.render('#/task/unknown');
  assert.match(app.nodes.get('#main').innerHTML,/这个页面暂时没有找到/);
  assert.equal(app.calls.length,0,'unknown IDs never reach a draft importer');
  app.render('#/project/start');
  assert.deepEqual(app.calls,[['project','start']]);
  const remote=JSON.parse(JSON.stringify(app.state()));
  remote.updatedAt='2099-01-01T00:00:00.000Z';
  remote.learning.draft.input='另一标签页的旧编辑内容，不得覆盖当前正在编辑的逐步草稿。';
  app.sandbox.document.activeElement={matches:selector=>selector.includes('[data-beginner-field]')};
  app.storage(remote);
  assert.equal(app.state().learning.draft.input,'当前另一份正式练习草稿，不能被旧任务入口直接覆盖。','cross-tab updates preserve a focused step editor');
  assert.equal(/function renderTask\(|data-task-field|data-task-upload|data-task-check/.test(source('app.js')),false,'the old form and edit handlers are removed');
  console.log('PASS: old bookmarks and history use protected step routing, retired editors cannot write, original records and downloads remain intact.');
})().catch(error=>{console.error(error);process.exitCode=1;});
