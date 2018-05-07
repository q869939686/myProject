// 先定义一个myMVVM的构造函数，需要的时候实例化对象
function myMVVM(options = {}){
    //将传入的对象所有属性挂载到$options上
    this.$options = options;
    //将所有数据data挂载到$data属性上,这是我们平时用的赋值属性的方法，直接-> 对象.属性=属性值
    var data = this.$data = options.data;
    // 数据劫持，将$data上的数据遍历使用Object.defineProperty挂载到$data上
    observe(data);
    // 将data的数据赋值到this实例上，实现数据代理
    for(let key in data){
        Object.defineProperty(this,key,{
            enumerable:true,
            configurable:false,
            get:function(){
                return this.$data[key]
            },
            set:function(newData){
                this.$data[key] = newData
            }
        })
    }
    // 计算属性
    InitComputed.call(this)
    // 模板编译
    Compile(options.el,this)
}


// 文本编译Compile
function Compile(el,vm){
    // el是div的id，表示替换范围
    vm.$el = document.querySelector(el);
    // 对于范围内的模板不可能一个个取，我们可以拿到内存中，创建一个文档碎片
    let fragment = document.createDocumentFragment();
    while(child = vm.$el.firstChild){
        fragment.appendChild(child)
    }
    // 定义一个正则，匹配{{}}
    let reg = /\{\{(.*)\}\}/;
    replace(fragment)
    function replace(fragment){
        Array.from(fragment.childNodes).forEach(function(node){
            let text = node.textContent;
            // 判断是否是元素节点，v-model属性实现
            if(node.nodeType===1){
                let nodeAttrs = node.attributes;//这是个类数组，转换一下
                Array.from(nodeAttrs).forEach(function(attr){
                    let name = attr.name;
                    let exp = attr.value
                    if(name.indexOf('v-')==0){
                        //简单写一下，如果是以‘v-'开头就认为是v-model，当然Vue要比这种判定复杂的多
                        // 这样就将数据放到了input中
                        node.value = vm[exp];
                    }
                    // 当数据改变时，这里也会更新
                    new Watcher(vm,exp,function(newVal){
                        node.value = newVal;
                    });
                    // input输入事件监听
                    node.addEventListener('input', e => {
                        let newVal = e.target.value;
                        vm[exp] = newVal;   
                    })
                })
            }
            // 判断是否是文本节点
            if(node.nodeType === 3 && reg.test(text)){
                let arr = RegExp.$1.split('.');
                let val = vm;
                arr.forEach(function(key){
                    val = val[key]
                });
                new Watcher(vm,RegExp.$1,function(newVal){//函数里要接受一个新值
                    // 替换函数被订阅
                    node.textContent = text.replace(reg,newVal)
                })
                node.textContent = text.replace(reg,val)
            }
            if(node.childNodes){
                replace(node)
            }
        })
    }
    vm.$el.appendChild(fragment)
}


// 数据劫持，将data中的每一个属性都用Object.defineProperty重新定义一遍
function Observe(data){
    let subscr = new Subscrible()
    for(let key in data){
        let val = data[key];
        // 如果有多层数据，递归调用
        observe(val);
        Object.defineProperty(data,key,{
            // 不可删除
            configurable:false,
            // 可枚举
            enumerable:true,
            // 调用的时候返回数据本身
            get:function(){
                Subscrible.target&&subscr.addSubs(Subscrible.target);//[watcher]
                return val
            },
            // 赋值的时候如果相等直接return，如果不等允许赋值
            set:function(newData){
                if( val === newData)return;
                val = newData;
                observe(newData);
                subscr.notify()//让所有watcher的update方法执行
            }
        })
    }
}
// 将Object.defineProperty封装成一个方法
function observe(data){
    // 如果不是对象直接return，防止进入死循环
    if (!data || typeof data !== 'object') return;
    return new Observe(data);
}


// 发布订阅模式
    // 利用Subscrible订阅函数，将函数放入subs数组中
function Subscrible(){
    this.subs = []
}
Subscrible.prototype.addSubs = function(sub){
    this.subs.push(sub);
}
Subscrible.prototype.notify = function(){
    this.subs.forEach(sub => sub.update())
}
    // Watcher是被观察者的构造函数，将被添加到Subscrible的数组中
function Watcher(vm,exp,fn){
    this.fn = fn;
    this.vm = vm;
    this.exp = exp;
    Subscrible.target = this;
    let val = vm;
    let arr = exp.split('.');
    arr.forEach(function(key){
        val = val[key]
    })
    Subscrible.target = null;
}
Watcher.prototype.update = function(){
    let val = this.vm;
    let arr = this.exp.split('.');
    arr.forEach(function(key){
        val = val[key]
    })
    this.fn(val)
}


// 计算属性
function InitComputed(){
    let vm = this;
    let computed = this.$options.computed;
    Object.keys(computed).forEach(function(key){
        Object.defineProperty(vm, key, {
            // 先判断一下是否是方法，如果是方法直接调用方法
            // 这里就不要Watcher了，computed依赖的age数据变化时会自动触发视图更新
            get: typeof computed[key] === 'function' ? computed[key] : computed[key].get,
            // computed没有设定set方法，就不屑set了
            set() {}
        });
    })
}
