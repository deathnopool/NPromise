// todo, bug: NPromise.resolve(NPromise.resolve(100)).then((value) => console.log("then >>>", value));
// todo, ts泛型支持
type RawPromise<T> = Promise<T>;
class NPromise
{
    private state: 'pending'|'resolved'|'rejected' = 'pending';
    private value;
    private error: any;
    private thenResolveFunc: Function;
    private thenRejectFunc: Function;

    public static BREAK = function() {};

    public static resolve(value?): NPromise
    {
        return new NPromise((resolve) => resolve(value));
    }

    public static reject(err?): NPromise
    {
        return new NPromise((resolve, reject) => reject(err));
    }

    public static then(callback: Function): NPromise
    {
        return NPromise.resolve().then((value) => callback(value));
    }

    public static wait(ms: number, value?): NPromise
    {
        return new NPromise((resolve, reject) => 
        {
            setTimeout(() => resolve(value), ms);
        });
    }

    public static foreach(arr: any[], itemCallback: Function): NPromise
    {
        const proccess = (i: number) => 
        {
            if (i>=arr.length)
                return NPromise.resolve();

            return NPromise.then(() => 
            {
                return itemCallback(arr[i], i);
            }).
            then((value) => 
            {
                if (value === NPromise.BREAK)
                    return;

                return proccess(i+1);
            });
        };

        return proccess(0);
    }

    public static all(promises: NPromise[]): NPromise
    {
        return new NPromise((resolve, reject) => 
        {
            let isRejected = false;
            for (let i=0, len=promises.length; i<len; i++)
            {
                promises[i].then(() => 
                {
                    if (!promises.find(promise => promise.isPending()))
                    {
                        resolve(promises.map(promise => promise.value));
                    }
                }, err => 
                {
                    if (!isRejected)
                    {
                        reject(err);
                        isRejected = true;
                    }
                });
            }
        });

    }

    public static race(promises: NPromise[]): NPromise
    {
        return new NPromise((resolve, reject) => 
        {
            let isRejected = false;
            let isResolved = false;
            for (let i=0, len=promises.length; i<len; i++)
            {
                promises[i].then((value) => 
                {
                    if (!isResolved)
                    {
                        resolve(value);
                        isResolved = true;
                    }
                }, err => 
                {
                    if (!isRejected)
                    {
                        reject(err);
                        isRejected = true;
                    }
                });
            }
        });
    }

    public static fromRawPromise(promise: RawPromise<any>): NPromise
    {
        return new NPromise((resolve, reject) => 
        {
            promise.then((value) => resolve(value), (err) => reject(err));
        });
    }

    constructor(callback: (resolve: Function, reject?: Function) => any)
    {
        const resolve = (value) => 
        {
            setTimeout(() => 
            {
                if (this.state !== 'pending')
                    throw new Error(`[resolve] promise[${this.state}] is not pending state`);
    
                this.state = 'resolved';
                this.value = value;
                if (this.thenResolveFunc)
                {
                    this.thenResolveFunc(this.value);
                }
            }, 0);
        };

        const reject = (err: any) => 
        {
            setTimeout(() => 
            {
                if (this.state !== 'pending')
                    throw new Error(`[reject] promise[${this.state}] is not pending state`);
    
                this.error = err;
                this.state = 'rejected';
                if (this.thenRejectFunc)
                {
                    this.thenRejectFunc(this.error);
                }
            }, 0);
        };

        callback(resolve.bind(this), reject.bind(this));
    }

    public isPending(): boolean
    {
        return this.state === 'pending';
    }

    public then(thenResolveFunc: Function, thenRejectFunc?: Function): NPromise
    {
        return new NPromise((resolve, reject) => 
        {
            if (thenResolveFunc)
            {
                this.thenResolveFunc = (value) => 
                {
                    try 
                    {
                        const result = thenResolveFunc(value);
                        if (result instanceof NPromise)
                        {
                            result.then((_value) => resolve(_value), (_value) => reject(_value));
                        }
                        else
                        {
                            resolve(result);
                        }
                    } 
                    catch(err)
                    {
                        reject(err);
                    }
                };
            }
            else
            {
                this.thenResolveFunc = (value) => 
                {
                    resolve(value);
                }
            }

            if (thenRejectFunc)
            {
                this.thenRejectFunc = (err) => 
                {
                    try
                    {
                        const result = thenRejectFunc(err);
                        if (result instanceof NPromise)
                        {
                            result.then((_value) => resolve(_value), (_value) => reject(_value));
                        }
                        else
                        {
                            resolve(result);
                        }
                    }
                    catch(err)
                    {
                        reject(err);
                    }   
                }
            }
            else
            {
                this.thenRejectFunc = (err) => 
                {
                    reject(err);
                }
            }
        });
    }

    public catch(catchCallback: Function): NPromise
    {
        return this.then(null, catchCallback);
    }

    public finally(finallyCallback: () => any): NPromise
    {
        let resolvedValue;
        let rejected = false;
        let rejectedErr;

        return this.then((value) => 
        {
            return resolvedValue = value;
        }, 
        (err) => 
        {
            rejected = true;
            rejectedErr = err;
        }).
        then(() => finallyCallback()).
        then(() => 
        {
            if (rejected)
                throw rejectedErr;

            return resolvedValue;
        });
    }

    public foreach(callback: (value?, index?: number) => any): NPromise
    {
        return this.then((value) => 
        {
            if (!Array.isArray(value))
            {
                return value;
            }

            return NPromise.foreach(value, callback);
        });
    }

    public map(callback: (value?, index?: number) => any): NPromise
    {
        return this.then((value) => 
        {
            if (!Array.isArray(value))
            {
                return value;
            }

            const result = [];
            
            return NPromise.foreach(value, (item, index) => 
            {
                return NPromise.then(() => callback(item, index)).then((value) => 
                {
                    result.push(value);
                });
            }).
            then(() => result);
        });
    }

    public toRawPromise(): RawPromise<any>
    {
        return new Promise((resolve, reject) => 
        {
            this.then((value) => resolve(value), err => reject(err));
        });
    }
}

// console.log("start");
// NPromise.foreach([1, 2, 3, 4, 5, 6], (item, i) => 
// {
//     return NPromise.wait(1000, item).then(() => 
//     {
//         console.log("foreach >>>", item);

//         if (item>=3)
//         {
//             return NPromise.BREAK;
//         }
//     });
// }).
// then(() => 
// {
//     console.log("end >>>");
// });

// NPromise.fromRawPromise(new Promise((resolve) => 
// {
//     setTimeout(() => resolve(200), 1000);
// })).
// then((value) => 
// {
//     console.log("then >>>", value);

//     return 300;
// }).
// toRawPromise().
// then((value) => 
// {
//     console.log("raw promise then >>>", value);
// });

// NPromise.race([
//     new NPromise((resolve) => setTimeout(() => resolve(123), 1000)),
//     new NPromise((resolve) => setTimeout(() => resolve(456), 2000))
// ]).then((v) => console.log('then >>>', v));
// NPromise.resolve(['this', 'is', 'promise', 'map']).map((item, i) => 
// {
//     console.log('this is map callback >>>', item, i);

//     return NPromise.wait(1000*i, item + i);
// }).
// then((value) => 
// {
//     console.log("then after map >>>", value);
// });

// NPromise.all(new Array(10).fill(1).map((n, i) => NPromise.reject('error occured'))).
// then((arr) => 
// {
//     console.log("then after promise.all", arr);
// }).
// catch((err) => 
// {
//     console.log("catch >>>", err);
// });
// NPromise.foreach(['hello', 'world', 'promise', 'foreach'], (value, index) => 
// {
//     console.log("value >>>", value, index);

//     return NPromise.wait(1000);
// });

// NPromise.resolve(['hello', 'world', 'promise', 'foreach']).foreach((value, index) => 
// {
//     console.log("value >>>", value, index);

//     return NPromise.wait(1000);
// });

// NPromise.wait(1000, 200).then((value) => 
// {
//     console.log("then >>>", value);
// });

// NPromise.resolve(123).
// then((value) => 456).
// finally(() => 
// {
//     console.log('call finally >>>');

//     return new NPromise((resolve) => 
//     {
//         setTimeout(() => resolve(789), 1000);
//     });
// }).
// then((value) => 
// {
//     console.log("then", value);

//     throw 404;
// }).
// finally(() => 
// {
//     console.log("second finally");
// }).
// catch((err) => 
// {
//     console.log("catch >>>", err);
// });

// NPromise.resolve(123).then((value) => 
// {
//     console.log("then >>>", value);

//     throw 404;
// }).
// catch((err) => 
// {
//     console.log("catch >>>", err);

//     throw 500;
// }).
// then((value) => 
// {   
//     console.log("second then >>>", value);
// }).
// catch((err) => 
// {
//     console.log("second catch >>>", err);

//     // return NPromise.reject(502);
//     return new NPromise((resolve, reject) => 
//     {
//         setTimeout(() => reject(502), 1000);
//     });
// }).
// then((value) => 
// {   
//     console.log("third then >>>", value);
// }).
// catch((err) => 
// {
//     console.log("third catch >>>", err);
// });

// const promise = new NPromise((resolve, reject) => 
// {
//     setTimeout(() => resolve(100), 1000);
//     // resolve("hello");
// }).
// then((value) => 
// {
//     console.log("then >>>", value);
//     return new NPromise((resolve) => 
//     {
//         setTimeout(() => resolve(200), 1000);
//     }).
//     then((value) => 
//     {
//         console.log("inner then >>>", value);

//         return new NPromise((resolve) => 
//         {
//             setTimeout(() => resolve(300), 1000);
//         }).
//         then((value) => 
//         {
//             console.log("inner inner then >>>", value);

//             return NPromise.resolve(400);
//         });
//     });
// }).
// then((value) => 
// {
//     console.log("second then >>>", value);
// });

// const promise = new NPromise((resolve, reject) => 
// {
//     setTimeout(() => reject(100), 1000);
// }).
// then((value) => 
// {
//     console.log("then >>>", value);
// }, (err) => 
// {
//     console.log("then reject", err);

//     return 200;
// }).
// catch((err) => console.log('catch >>>', err)).
// then((value) => 
// {
//     console.log("then after catch", value);
// });

// NPromise.reject(404).
// then((err) => 
// {
//     console.log("resolve then >>>", err);
// }).
// then(() => 
// {
//     console.log("second resolve then >>>");
// }).
// catch((err) => 
// {
//     console.log("catch >>>", err);
    
//     return 100;
// }).
// then((value) => 
// {
//     console.log("third resolve then >>>", value);
// });
