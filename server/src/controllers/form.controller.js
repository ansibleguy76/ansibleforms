'use strict';
const Form=require("../models/form.model")
exports.findAll = function(req,res){
  try{
    var forms = Form.load()
    res.json(forms)
  }catch(error){
    res.json({error:error})
  }
}
