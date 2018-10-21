
class Promise {
    constructor(executor){
        // 将数据定义在实例上，方便外部存取
        this.value = undefined;
        this.reason = undefined;
        // promise 有三个状态，初始转态为pending
        this.status = 'pending';
        // 存储用户异步操作executor时，then中的回调函数
        this.onFulfilledCallbacks = [];
        this.onRejectedCallbacks = [];

        /*
         promise 只能从pending => resolved
                 或者从pending => rejected
         状态一旦从pending发生变化后，就不能再次修改，
         所以在改变状态之前，先要对当前的变化进行判断
        * */
        let resolve = value => {
            if(this.status === 'pending'){
                // 将传入的值替换原有的
                this.value = value;
                // 成功回调让 status 变成 成功态
                this.status = 'resolved';
                // promise 执行时循环对应的then函数
                this.onFulfilledCallbacks.forEach(function (fn) {
                    fn();
                })
            }
        };

        let reject = reason => {
            if(this.status === 'pending'){
                this.reason = reason;
                // 失败回调让 status 变成 失败态
                this.status = 'rejected';
                this.onRejectedCallbacks.forEach(function (fn) {
                    fn();
                })
            }
        };

        /*
         如果用户在进行函数操作时，直接让其抛出错误，就让他执行reject函数,如下：
         let p = new Promise(function (reselve,reject) {
            throw new TypeError('失败了')
         });
        * */
        try{
            executor(resolve,reject)
        }catch (e){
            console.log(e);
        }
    }



    /*
     一、实现then的方法 p.then(data => {},err => {});
     1、promise实例调用then
     2、由两个函数作为参数
     3、then 中的两函数的执行由promise返回的状态决定
     4、then 中的两函数将外部接受的数据，作为参数传入
     * */
    then (onFulfilled,onReject){
        // 判断用户在then中输入的是否是函数，因为有可能用户直接用null进行占位操作
        // p.then(null,(err)=>{})
        onFulfilled = (typeof onFulfilled === 'function') ? onFulfilled : function (data) {
            return data
        };
        onReject = (typeof onReject === 'function') ? onReject : function (err) {
            // return err 可能下一个then就执行resolve，直接让他抛出错误
            throw err
        };


        /*
        二、实现then的链式调用
        1、then 需要返回一个promise实例才能继续调用then
        2、用变量x来接收then的返回值，对x进行判断
           返回的是promise实例：调取then的方法
           返回普通类型值：直接执行resolve函数
        * */
        let promise2 = new Promise((resolve,reject) => {
            // promise A+ 规范 then 中函数为异步
            if(this.status === 'resolved'){
                setTimeout(() => {
                    try{
                        let x = onFulfilled(this.value);
                        thenCallback(x,promise2,resolve,reject)
                    }catch (e){
                        reject(e)
                    }
                },0);
            }
            if(this.status === 'rejected'){
                setTimeout(() => {
                    try{
                        let x = onReject(this.reason);
                        thenCallback(x,promise2,resolve,reject)
                    }catch (e){
                        reject(e)
                    }
                },0);
            }
            /**
             异步操作promise 中 executor 的函数，如下：
             let p = new Promise(function (reselve,reject) {
                 setTimeout(()=>{
                    reject('失败了')
                 },1000);
             });
             此时 同步then中函数会先执行（promise中的状态一直处于pending），then执行完后，再执行promise
             我们可以定义两个空数组，分别存储then中成功态和失败态要回调的函数，等到promise状态改变时，在调用相应的函数（为何存数组，用户可能操作多个独立的then方法，这里指的不是链式调用）
             p.then();
             p.then();
            * */
            if(this.status === 'pending'){
                // this.onFulfilledCallbacks.push(onFulfilled(this.value))
                // 这样onFulfilled(this.value)会执行，存储的是函数返回值，而我们需要函数本身
                this.onFulfilledCallbacks.push(() => {
                    setTimeout(() => {
                        try{
                            let x = onFulfilled(this.value);
                            thenCallback(x,promise2,resolve,reject)
                        }catch (e){
                            reject(e)
                        }
                    },0);
                });
                this.onRejectedCallbacks.push(() => {
                    setTimeout(() => {
                        try{
                            let x = onReject(this.reason);
                            thenCallback(x,promise2,resolve,reject)
                        }catch (e){
                            console.log('e',e)
                            reject(e)
                        }
                    },0);

                })
            }
        });

        return promise2;
    }

    // this.then(null,reject)别名
    catch (fnErr){
        return this.then(null,fnErr)
    }

    static resolve (value){
        console.log(new Promise((resolve,reject) => {
            resolve(123123)
        }).then(data=>{
            console.log(data);
        }))
        return new Promise((resolve,reject) => {
            resolve(value)
        })
    }

    static reject (reason){
        return new Promise((resolve,reject) => {
            reject(reason)
        })
    }

    // 不管上一个函数返回的是什么状态都会执行该函数，并把上一个状态原封不动的传递下去
    finally (callback){
        return this.then( (data) =>{

            // 返回一个promise,将上一次的状态继续传递下去
            return Promise.resolve(callback()).then(()=>data)
        }, (reason)=> {
            console.log('datatata')
            callback();
            return Promise.resolve().then(()=>{
                throw reason
            })
        })
    }

    // 全部成功才成功 有任意一个失败 都会失败
    // promise.all()的参数，可以不是数组，但是必须具有Iterator接口（即可遍历的），且返回的每个成员都是promise实例
    static all (promises){
        // 返回promise实例
        return new promise(function (resolve,reject) {

            let arr = [],
                currentIndex = 0;

            let storage = (val,index) => {
                // 实时存储成员成功态时的数据
                arr[index] = val;
                currentIndex++;

                // 如果成员调取成功态的次数 和 成员数相同，all返回成功态,将数据进行传递
                if(currentIndex == promises.length){
                    resolve(arr)
                }
            };

            // 遍历每一成员
            for(let i=0;i<promises.length;i++){
                // promises[i].then(data => {
                //     storage(data,i)
                // },err => { // 如果有走到then的失败函数，直接抛出错误
                //     reject;
                // })
                // 与上面函数相同
                promises[i].then(data => {
                    storage(data,i)
                },reject)
            }
        })
    }
    
    static race (promises){
        return new promises(function (resolve,reject) {
            for(let i=0;i<promises.length;i++){
                promises[i].then(resolve,reject)
            }
        })
    }
}


/*
 三、对then的返回值 x 进行判断
 返回的是promise实例：调取then的方法
 返回普通类型值：直接执行resolve函数
 * */
let thenCallback = (x,promise2,resolve,reject) => {
    /*
     特殊情况，如
     let promise2 = p.then(function (data) {
     return promise2
     })
     返回一个promise对象，但是没有任何机能触发promise中的函数，所以他处在一直等待自己执行的状态
     * */

    if(x === promise2){
        return reject(new TypeError('循环引用'))
    }
    // 避免用户既调用成功又调用失败的回调函数
    let callback;
    // 初步判定返回的可能是一个promise
    if(x != null && (typeof x === 'function' || typeof x === 'object')){
        // 再对x.then的返回值进行判断
        let then = x.then;
        // console.log('dd',x.then);

        try{ // 避免x.then取值发生错误

            // 是一个promise，执行then方法
            if(typeof then === 'function'){




                // console.dir(then);

                then.call(x,function (y) {
                    if(!callback){
                        callback = true
                    }else {
                        return
                    }
                    // resolve(y)
                    // 此时 y 也有可能是promise，让他一直递归，直到变为常量
                    thenCallback(y,promise2,resolve,reject)

                },function (r) {
                    if(!callback){
                        callback = true
                    }else {
                        return
                    }
                    reject(r)
                })

            }else {

                if(!callback){
                    callback = true
                }else {
                    return
                }
                resolve(x)
            }

        }catch (e){
            if(!callback){
                callback = true
            }else {
                return
            }
            reject(e)
        }


    }else { // 普通类型值
        resolve(x)
    }

};





let p = new Promise(function (resolve,reject) {
    setTimeout(()=>{
        reject('成功了')
    },1000);
});

p.then(null,function (reason) {
    throw reason
}).finally(function () {
    console.log('finally')
}).then(null,function (err) {
    console.log('2rej', '-------');
});

// p.then(function (data) {
//     console.log('data',data);
//     return data
// },function (reason) {
//     console.log('reason',reason);
//     throw reason
// }).then(function (data) {
//     console.log('2res',data);
// },function (err) {
//     console.log('2rej', err);
// })

