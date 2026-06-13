window.initPerjanjianView = function(){
  console.log("📄 Perjanjian View");
  const user = window.currentUser;

  if(!user){
    return;
  }

  // nanti isi data perjanjian disini
  // contoh:
  //
  // document.getElementById(
  //   "perjanjianNomor"
  // ).innerText = "AGR-001-2025";

};