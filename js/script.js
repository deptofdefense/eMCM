			var headers = [];

			var rules = [];

			var main = document.getElementsByClassName("level1");

			var secondary = [];

			function firstLevel() {
				var x = document.getElementsByTagName("H1");
				var element = document.getElementById("popup");
				if (element.childElementCount < 2) {
					for (i=2; i<x.length; i++) {
						var p = document.createElement("p");
						var n = document.createTextNode(x[i].innerHTML);
						p.appendChild(n);
						p.addEventListener("click",secondLevel);
						p.setAttribute("class","RCMseries");
						element.appendChild(p);
						headers.push(p);
					}
				}
				document.getElementById("RCM").style.opacity = ".5";
				document.getElementById("punitivearticles").style.display = "none";
				document.getElementById("MRE").style.display = "none";
				element.style.display = "inline";
				element.style.opacity = ".75";
				document.getElementById("RCM").removeAttribute("onclick");
			}

			function secondLevel() {
				var x = headers.indexOf(this);
				var y = main[x+1].getElementsByTagName("H2");
				var a = main[x+1].getElementsByClassName("level2");
				var element = document.getElementById("next");
				var z = element.children.length;
						for (i=z; i>1; i--) {
							element.removeChild(element.lastElementChild);
							rules.pop();
							secondary.pop();
						}
						for (i=0; i<y.length; i++) {
							var p = document.createElement("p");
							var n = document.createTextNode(y[i].innerHTML);
							p.appendChild(n);
							p.addEventListener("click",thirdLevel);
							element.appendChild(p);
							rules.push(p);	
							secondary.push(a[i]);			
						}
				document.getElementById("popup").style.opacity = "0";
				document.getElementById("popup").style.display = "none";
				element.style.display = "inline";
				element.style.opacity = ".75";

			}

			function thirdLevel() {
				var x = rules.indexOf(this);
				var z = secondary[x].cloneNode(true);
				var element = document.getElementById("modal");
				var c = element.children.length;
						for (i=c; i>1; i--) {
							element.removeChild(element.lastElementChild);
						}
				element.appendChild(z);
				element.style.display = "block";
			}

function closePopup() {
	document.getElementById("popup").style.opacity = "0";
	document.getElementById("popup").style.display = "none";
	document.getElementById("punitivearticles").style.display = "inline";
	document.getElementById("MRE").style.display = "inline";
	document.getElementById("RCM").style.opacity = "1";
	document.getElementById("RCM").setAttribute("onclick","firstLevel()");
}
function closeNext() {
	document.getElementById("next").style.opacity = "0";
	document.getElementById("next").style.display = "none";
	document.getElementById("popup").style.display = "inline";
	document.getElementById("popup").style.opacity = ".75";	
}