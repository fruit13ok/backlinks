console.log("Sanity Check: JS is working!");
let backendRoute = new URL("http://localhost:8000/api");

const getScrape = async (backendRoute, formObj) => {
    try {
        const response = await fetch(backendRoute, {
            method: 'POST', // or 'PUT'
            body: JSON.stringify(formObj), // data can be `string` or {object}!
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('response',response);
        let json = await response.json();
        console.log('json',json);
        let mList = document.getElementById('result-list');
        mList.innerHTML = '';
        let pre = document.createElement('pre');
        pre.innerHTML = JSON.stringify(json, null, 4);
        mList.appendChild(pre);
    }catch (error) {
        console.log(error);
    }
};

// submit button clicked, pass form data into scrape function and invoke it
$(document).ready(function(){
    $("#button1").click(function(){
        let formArr = $("#form1").serializeArray();
        // convert form array of objects to an object of properties
        let formObj = formArr.reduce((map, obj) => {
            map[obj.name] = obj.value;
            return map;
        }, {});
        document.getElementById('result-list').innerHTML = 
        '<p style="color:blue;font-size:46px;"><strong> ... Searching please wait ... </strong></p>';
	    console.log('formObj',formObj);
        getScrape(backendRoute, formObj);
    });
});