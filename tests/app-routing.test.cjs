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
      addEventListener(){},setAttribute(){},focus(){},select(){},click(){},remove(){},scrollIntoView(){},
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
    URL:class extends URL {static createObjectURL(blob){files.push(blob);return 'blob:test';} static revokeObjectURL(){}},
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
  for(const name of ['content.js','curriculum.js','scenario-courses.js','quality-core.js','workflow-content.js','workflow-core.js','core.js','assets/vendor/marked.umd.js','markdown.js','workflow.js','tutor-content.js','tutor-courses-office.js','tutor-courses-analysis.js','tutor-courses-skills.js','tutor-catalog.js','tutor-provider.js','tutor.js']) vm.runInContext(source(name),sandbox,{filename:name});
  vm.runInContext(String.raw`
    var initial = AgentLearningCore.createState(AgentCourseContent);
    initial.tasks.meeting.mode='practice';
    initial.tasks.meeting.input='原始会议资料，日期和责任人尚有待确认的内容。';
    initial.tasks.meeting.output='## 旧成果完整原文\n\n不能因切换入口丢失。<script>不执行</script>';
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
  assert.match(page,/<h2>旧成果完整原文<\/h2>/,'historical output gets a formatted preview');
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
  for(const id of ['pdf','email','feedback','presentation','cleanup','files']) {
    app.render('#/lesson/l-scene-'+id);
    const lesson=app.nodes.get('#main').innerHTML;
    assert.match(lesson,/场景加练 · 按需选学/);
    assert.ok(lesson.includes('data-task="'+id+'"'),'each new course leads directly to its practice');
    assert.equal(/第 null 周|第 7 周|undefined/.test(lesson),false);
  }
  app.render('#/route');
  assert.match(app.nodes.get('#main').innerHTML,/场景加练/);
  assert.equal(/第 null 周/.test(app.nodes.get('#main').innerHTML),false);
  app.render('#/tasks');
  assert.match(app.nodes.get('#main').innerHTML,/href="#\/workflow\/feedback-workflow"/);
  assert.match(app.nodes.get('#main').innerHTML,/href="#\/workflow\/meeting-handoff"/);
  assert.match(app.nodes.get('#task-list').innerHTML,/场景加练/);
  assert.equal((app.nodes.get('#task-list').innerHTML.match(/data-project-action="choose-task"/g)||[]).length,12);
  app.render('#/workflow/feedback-workflow');
  assert.match(app.nodes.get('#main').innerHTML,/填入示例产物/);
  assert.match(app.nodes.get('#nav-links').innerHTML,/class="nav-item active" href="#\/tasks"/);
  const [definition,meeting]=app.sandbox.AcademyWorkflowContent;
  const workflow=app.sandbox.AcademyWorkflowCore;
  const legacyBrief='## 之前保存的简报\n\n保留原始内容。';
  const prepared=definition.steps.slice(0,-1).reduce((record,step,index)=>
    workflow.confirm(workflow.updateOutput(record,index,step.example),index),workflow.blank(definition));
  const completed=workflow.confirm(workflow.updateOutput(prepared,2,legacyBrief),2);
  app.storage({...app.state(),workflows:{[definition.id]:{record:completed,updatedAt:app.state().updatedAt}}});
  assert.deepEqual(app.context().K.normalizeState(app.state(),app.context().C,{strict:true}).workflows[definition.id].record,completed);
  app.render('#/workflow/feedback-workflow');
  assert.match(app.nodes.get('#main').innerHTML,/工作流已完成/);
  app.render('#/artifacts');
  assert.match(app.nodes.get('#main').innerHTML,/查看工作流成果/);
  assert.doesNotMatch(app.nodes.get('#main').innerHTML,/href="#\/workflow\/meeting-handoff"/);
  app.render('#/workflow/meeting-handoff');
  assert.match(app.nodes.get('#main').innerHTML,/从记录提取待办/);
  assert.equal((app.nodes.get('#main').innerHTML.match(/data-workflow-step=/g)||[]).length,meeting.steps.length);
  const incoming=structuredClone(app.state());
  delete incoming.workflows[definition.id];
  const meetingDraft=workflow.updateOutput(workflow.blank(meeting),0,meeting.steps[0].example);
  incoming.workflows[meeting.id]={record:meetingDraft,updatedAt:incoming.updatedAt};
  app.storage(incoming);
  assert.equal(app.state().workflows[meeting.id].record.steps[0].output,meeting.steps[0].example);
  assert.equal(app.state().workflows[definition.id].record.steps[2].output,legacyBrief);
  app.render('#/workflow/unknown');
  assert.match(app.nodes.get('#main').innerHTML,/没有找到/);
  const savedBeforeTutor=JSON.stringify(app.state());
  app.render('#/overview');
  assert.match(app.nodes.get('#main').innerHTML,/href="#\/route">查看 AI 教练课/);
  app.render('#/route');
  const catalog=app.nodes.get('#main').innerHTML;
  assert.match(catalog,/AI 教练课[\s\S]*开始上课[\s\S]*自主学习/);
  assert.match(catalog,/href="#\/tutor\/meeting"/);
  assert.doesNotMatch(catalog,/id="tutor-input"/);
  assert.equal((catalog.match(/class="tutor-course-card /g)||[]).length,11);
  for(const course of app.sandbox.AcademyTutorCatalog) {
    assert.ok(catalog.includes('href="#/tutor/'+course.slug+'"'));
    app.render('#/tutor/'+course.slug);
    const classroom=app.nodes.get('#main').innerHTML;
    assert.ok(classroom.includes(course.title));
    assert.match(classroom,/id="tutor-input"/);
  }
  app.render('#/tutor/unknown');
  assert.match(app.nodes.get('#main').innerHTML,/没有找到/);
  app.render('#/tutor/meeting');
  assert.match(app.nodes.get('#main').innerHTML,/id="tutor-input"/);
  assert.match(app.nodes.get('#main').innerHTML,/课程讲解/);
  assert.match(app.nodes.get('#main').innerHTML,/课程大纲/);
  assert.match(app.nodes.get('#main').innerHTML,/href="#\/route">返回课程/);
  assert.equal(JSON.stringify(app.state()),savedBeforeTutor);
  app.render('#/settings');
  assert.match(app.nodes.get('#main').innerHTML,/23 节短课 · 12 个任务包/);
  console.log('PASS: old bookmarks and history use protected step routing, retired editors cannot write, original records and downloads remain intact.');
})().catch(error=>{console.error(error);process.exitCode=1;});
