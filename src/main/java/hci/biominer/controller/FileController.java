package hci.biominer.controller;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

import javax.servlet.http.HttpServletResponse;

import org.apache.commons.io.FilenameUtils;
import org.apache.log4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.util.FileCopyUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import returnModel.BooleanModel;
import returnModel.FileMeta;
import returnModel.PreviewMap;
import hci.biominer.model.genome.Genome;
import hci.biominer.model.AnalysisType;
import hci.biominer.model.ExternalGene;
import hci.biominer.model.OrganismBuild;
import hci.biominer.model.Project;
import hci.biominer.model.FileUpload;
import hci.biominer.model.access.Lab;
import hci.biominer.model.access.Institute;
import hci.biominer.service.AnalysisTypeService;
import hci.biominer.service.ExternalGeneService;
import hci.biominer.service.FileUploadService;
import hci.biominer.service.OrganismBuildService;
import hci.biominer.service.ProjectService;
import hci.biominer.parser.ChipParser;
import hci.biominer.parser.RnaSeqParser;
import hci.biominer.parser.VCFParser;
import hci.biominer.util.BiominerProperties;
import hci.biominer.util.Enumerated.FileStateEnum;
import hci.biominer.util.Enumerated.FileTypeEnum;
import hci.biominer.util.GenomeBuilds;
import hci.biominer.util.IO;
import hci.biominer.util.ModelUtil;

@Controller
@RequestMapping("/submit")
public class FileController {
	
	@Autowired
	private FileUploadService fileUploadService;
	
	@Autowired
	private ProjectService projectService;
	
	@Autowired
	private ExternalGeneService externalGeneService;
	
	@Autowired
	private OrganismBuildService organismBuildService;
	
	@Autowired
	private AnalysisTypeService analysisTypeService;
	
	@Autowired
	private SubmitController submitController;
	
	public static final Pattern WHITE_SPACE = Pattern.compile("\\s+");
	public static final Pattern NON_WORD = Pattern.compile("[^\\w]+");
	private static final Logger lg = Logger.getLogger(FileController.class);

	public static void checkProperties() throws Exception{
		if (!BiominerProperties.isLoaded()) BiominerProperties.loadProperties();
	}
	
	public static File generateFilePath(FileUpload fileUpload) throws Exception  {			
			checkProperties();
			File localDirectory = new File(BiominerProperties.getProperty("filePath"));
			File subDirectory = new File(localDirectory,fileUpload.getDirectory());
			File filePath = new File(subDirectory,fileUpload.getName());
			return filePath;
	}
	
	public static File getRawDirectory() throws Exception {
		return createDirectory("raw");
	}
	
	public static File getParsedDirectory() throws Exception {
		return createDirectory("parsed");
	}
	
	public static File getDownloadDirectory() throws Exception {
		return createDirectory("results");
	}
	
	public static File getGenomeDirectory() throws Exception {
		return createDirectory("genome");
	}
	
	public static File getIgvDirectory() throws Exception {
		return createDirectory("IGV");
	}
	
	public static File getGenesDirectory() throws Exception {
		return createDirectory("genes");
	}
	
	public static File getQueryDirectory() throws Exception {
		return createDirectory("queries");
	}
	
	public static File getTfRawDirectory() throws Exception {
		return createDirectory("tfFilesRaw");
	}
	
	public static File getTfParseDirectory() throws Exception {
		return createDirectory("tfFilesParse");
	}
	
	public static File getHomologyDirectory() throws Exception {
		return createDirectory("homology");
	}
	
	public static File getLiftoverDirectory() throws Exception  {
		return createDirectory("liftover");
	}
	
	public static File getLiftoverWorkingDirectory() throws Exception {
		return createDirectory("liftover_working");
	}
	
	private static File createDirectory(String subdir) throws Exception {
		checkProperties();
		File localDirectory = new File(BiominerProperties.getProperty("filePath"));
		File subDirectory = new File(localDirectory,subdir);
		if (!subDirectory.exists()) subDirectory.mkdir();
		return subDirectory;
	}

	/***************************************************
	 * URL: /submit/uploadchunk  
	 * upload(): receives files
	 * post():
	 * @param file : MultipartFile
	 * @return FileMeta as json format
	 ****************************************************/
	@RequestMapping(value="uploadchunk", method = RequestMethod.POST)
	@ResponseBody 
	public FileMeta uploadchunk(@RequestParam("file") MultipartFile file,
			@RequestParam("index") Integer index, 
			@RequestParam("total") Integer total, 		
			@RequestParam("idProject") Long idProject,
			@RequestParam("idFileUpload") Long idFileUpload,
			@RequestParam("name") String name,
			HttpServletResponse response) throws Exception {
	
		FileMeta fm = new FileMeta();

		if (!file.isEmpty()) {
			File localFile = null;
			try {
				
				//Create directory
				File directory = new File(getRawDirectory(),String.valueOf(idProject));
				if (!directory.exists()) {
					directory.mkdir();
				}

				int ftype = 0;
				if (name.endsWith(".bam") || name.endsWith(".bai") || name.endsWith(".useq") || name.endsWith(".bw") || name.endsWith(".gz") || name.endsWith(".zip")) {
					localFile = new File(directory,name);
				}
				else {
					localFile = new File(directory,name + ".gz");
					ftype = 1;
				}
				
				//If first file, set append flag to false and delete existing files with the same name.
				boolean append = true;
				if (index == 0) {
					if (localFile.exists()) {
						localFile.delete();
					}
					append = false;
				}
				
				//copy file to directory
				if (name.endsWith(".bam") || name.endsWith(".bai") || name.endsWith(".useq") || name.endsWith(".bw") || name.endsWith(".gz") || name.endsWith(".zip")) {
					FileCopyUtils.copy(file.getInputStream(), new FileOutputStream(localFile,append));
				} 
				else {
					FileCopyUtils.copy(file.getInputStream(), new GZIPOutputStream(new FileOutputStream(localFile,append)));
				}
					
				//If last file, return info
				if (index+1 == total) {
					FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
					
					if (ftype == 1) {
						name = name + ".gz";
						fileUpload.setName(name + ".gz");
						
					}
					
					fileUpload.setName(name);
					
					fileUploadService.updateFileUpload(idFileUpload, fileUpload);
					
					fm.setFinished(true);
					fm.setState("SUCCESS");
					fm.setMessage("");
					fm.setName(name);
				}					
				
			} catch (Exception ex) {
				//update file upload
				ex.printStackTrace();
	
				FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
				fileUpload.setMessage(ex.getMessage());
				
				fileUploadService.updateFileUpload(idFileUpload, fileUpload);
				
				//setup file meta
				fm.setFinished(true);
				fm.setMessage(ex.getMessage());
				fm.setState("FAILURE");
				
				response.setStatus(405);
			}			
				
		} else {
			System.out.println("File is empty");
			FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
			fileUpload.setMessage("file is empty");
			fileUpload.setState(FileStateEnum.FAILURE);
			fileUploadService.updateFileUpload(idFileUpload, fileUpload);
			fm.setFinished(true);
			fm.setMessage("file is empty");
			fm.setState("FAILURE");
			response.setStatus(405);
		}
		return fm;
	}
	
	/**************************************************
	 * URL: /submit/createUploadFile
	 * createUploadFile
	 * This command creates an entry for the file in the biominer database
	 * post():
	 * @param name : filename
	 * @param idProject : project identifier
	 * @param size : size of the file.
	 */
	@RequestMapping(value="/createUploadFile", method=RequestMethod.POST)
	@ResponseBody
	public FileUpload createUploadFile(@RequestParam("name") String name, @RequestParam("size") Long size, @RequestParam("idProject") Long idProject, HttpServletResponse response) {
				
		File directoryStub = new File("/raw/",String.valueOf(idProject));

		//Grab project object
		Project project = projectService.getProjectById(idProject);
	
		//Setup fileUpload object.
		FileUpload fileUpload = new FileUpload();
		fileUpload.setDirectory(directoryStub.getPath());
		fileUpload.setState(FileStateEnum.INCOMPLETE);
		fileUpload.setMessage("");
		fileUpload.setType(FileTypeEnum.UPLOADED);
		fileUpload.setProject(project);
		fileUpload.setSize(size);
		fileUpload.setName(name);
						
		fileUploadService.addFileUpload(fileUpload);
		return fileUpload;
	}
	
	/**************************************************
	 * URL: /submit/createImportFile
	 * createImportFile
	 * This command creates an entry for the file in the biominer database
	 * post():
	 * @param name: Name of the file
	 * @param idProject: project identifier
	 */
	@RequestMapping(value="/createImportFile", method=RequestMethod.POST)
	@ResponseBody
	public FileUpload createImportFile(@RequestParam("name") String name, @RequestParam("idProject") Long idProject, @RequestParam("idParent") Long idParent) {
				
		File directoryStub = new File("/parsed/",String.valueOf(idProject));

		//Grab project object
		Project project = projectService.getProjectById(idProject);
		FileUpload parent = fileUploadService.getFileUploadById(idParent);
	
		//Setup fileUpload object.
		FileUpload fileUpload = new FileUpload();
		fileUpload.setDirectory(directoryStub.getPath());
		fileUpload.setState(FileStateEnum.INCOMPLETE);
		fileUpload.setMessage("");
		fileUpload.setType(FileTypeEnum.IMPORTED);
		fileUpload.setProject(project);
		fileUpload.setParent(parent);
		fileUpload.setName(name);
		fileUpload.setSize((long)0);
					
		fileUploadService.addFileUpload(fileUpload);
		return fileUpload;
	}
	
	/***************************************************
	 * URL: /submit/upload/get/
	 * get(): get file as an attachment
	 * @param response : passed by the server
	 * @param file : filename
	 * @param type : file type (IMPORTED or UPLOADED)
	 * @return void
	 * @throws Exception 
	 ****************************************************/
	 @RequestMapping(value = "/upload/get", method = RequestMethod.GET)
	 @ResponseBody
	 public void getUpload(HttpServletResponse response,@RequestParam("file") String file, @RequestParam("type") FileTypeEnum type, @RequestParam("idProject") Long idProject) throws Exception{
		 Project project = projectService.getProjectById(idProject);
		 FileUpload fileUpload = fileUploadService.getFileUploadByName(file,type,project);
		 
		 if (fileUpload == null) {
			try {
				response.sendError(400,"The specified file type is not recognized");
			} catch (IOException e) {
				e.printStackTrace();
			}
			return;
		 }
		 
		 try {		
		 	//response.setContentType(getFile.getFileType());
		 	response.setHeader("Content-disposition", "attachment; filename=\""+fileUpload.getName()+"\"");
		 	
		 	File localFile = generateFilePath(fileUpload);
		 	BufferedInputStream bis = new BufferedInputStream(new FileInputStream(localFile));
		 	
	        FileCopyUtils.copy(bis, response.getOutputStream());
		 }catch (IOException e) {
			e.printStackTrace();
		 }
	 }

	 
	 /***************************************************
	 * delete: Delete uploaded/parsed file
	 * @param idFileUpload : file identifier
	 * @return void
	 ****************************************************/
	 @RequestMapping(value="/upload/deleteFileUpload", method=RequestMethod.DELETE)
	 @ResponseBody 
	 public void deleteFileUpload(@RequestParam("idFileUpload") Long idFileUpload) throws Exception{
		 deleteFile(idFileUpload);
	}
	 
	 /***************************************************
	 * URL: /submit/upload/load/
	 * get(): add already loaded files into the hash
	 * @param response : passed by the server
	 * @param file : filename
	 * @param type : file type (parsed or imported)
	 * @return void
	 ****************************************************/
	@RequestMapping(value = "upload/load", method = RequestMethod.GET)
	@ResponseBody 
	public List<FileUpload>  get(HttpServletResponse response, @RequestParam("type") FileTypeEnum type, @RequestParam("idProject") Long idProject){
		Project project = projectService.getProjectById(idProject);
		List<FileUpload> fileMap = fileUploadService.getFileUploadByType(type,project);
		return fileMap;
	}
	
	 /***************************************************
	 * URL: /submit/parse/preview/
	 * post(): Generate a file preview
	 * @param file : filename
	 * @return PreviewMap: Container that holds the file preview
	 * @throws Exception 
	 ****************************************************/
	@RequestMapping(value = "parse/preview", method = RequestMethod.GET)
    @ResponseBody
	public PreviewMap getHeader(@RequestParam(value="name") String name, @RequestParam("idProject") Long idProject) throws Exception {
		 Project project = projectService.getProjectById(idProject);
		 FileUpload fileUpload = fileUploadService.getFileUploadByName(name, FileTypeEnum.UPLOADED, project);
		 PreviewMap pm = new PreviewMap();
		 
		 try {		
			 	//initialize variables
			 	String temp = null;
			 	int counter = 0;
			 	
			 	//Open a buffered reader
			 	BufferedReader br = ModelUtil.fetchBufferedReader(generateFilePath(fileUpload));
			 
			 	//Grab the first 20 lines of the file
			 	String[] lastHeader = null;
			 	while((temp = br.readLine()) != null) {
			 		if (temp.startsWith("#")) {
			 			lastHeader  = temp.split("\t");
			 			continue;
			 		}
			 		
			 		if (lastHeader != null) {
			 			pm.addPreviewData(lastHeader);
			 			lastHeader = null;
			 		}
			 		
			 		if (counter == 10) {
			 			break;
			 		}
			 		
			 		//split the file by tabs and add to the preview object
			 		String[] items = temp.split("\t");
			 		//LinkedList<String> dataLine = new LinkedList<String>(Arrays.asList(items));
			 		
			 		pm.addPreviewData(items);
			 		counter++;
			 	}
			 	
			 	pm.setMessage("success");
			 	br.close();
		 }catch (IOException ioex) {
			    pm.setMessage("Error processing file: " + ioex.getMessage());
			    System.out.println("Error messaging: " + ioex.getMessage());
		 }
		 return pm;
	 }
	
	
	
	
	
	
	 /***************************************************
	 * URL: /submit/upload/updatepaths/
	 * updateParsedFilePaths(): This updates the file paths for parsed data files and moves 
	 * them to new directories when needed.  Call it after modifying the name of the Institute, 
	 * Lab, Project, or AnalysisType e.g. http://localhost:8080/biominer/submit/upload/updatepaths
	 * @author Nix
	 * @param response : passed by the server
	 * @return void
	 ****************************************************/
	@RequestMapping(value = "upload/updatepaths", method = RequestMethod.GET)
	@ResponseBody 
	public boolean  updateParsedFilePaths(HttpServletResponse response){

		lg.info("Attempting to update parsed file paths...");

		try {
			//get all projects
			List<Project> projects = projectService.getAllProjects();
			//get the root dir where files are kept
			File rootDir = new File(BiominerProperties.getProperty("filePath"));

			//for each project
			for (Project project: projects){

				//for each file in the project
				List<FileUpload> fus = project.getFiles();
				for (FileUpload fu: fus){
					
					//is it a parsed file?
					if (fu.getType().toString().equals("IMPORTED")){
						
						//load objects to build annotated path
						AnalysisType at = fu.getAnalysisType();
						OrganismBuild gb = project.getOrganismBuild();
						
						//create the current file and check if it is there
						File currFile = new File (rootDir, fu.getDirectory()+File.separator+fu.getName());
						lg.info("CURR  : "+currFile.getCanonicalPath());
						if (currFile.exists() == false) throw new IOException("File doesn't exist?! "+currFile+" Aborting parsed file path updates.");
							
						//create new location dir and file
						File newDir = fetchAnnotatedParseDirectory(gb, at, project);
						File newFile = new File (newDir, currFile.getName());
						
						//move it?
						if (currFile.getCanonicalPath().equals(newFile.getCanonicalPath()) == false && newFile.exists() == false){
							lg.info("MOVE2 : "+newFile.getCanonicalPath());
							String newDirAll = newDir.getCanonicalPath();
							String newDirRel = newDirAll.replace(BiominerProperties.getProperty("filePath"), "");
							
							//attempt the move
							if (currFile.renameTo(newFile) == false) throw new IOException ("Failed to move "+currFile+" to "+newFile+", ABORTING parsed file path updates.");
							
							//all good so modify the db, wish there was a way to find out if there was a problem here, could then reverse the file move
							lg.info("Changing rel dir from "+fu.getDirectory()+" -> "+newDirRel);
							fu.setDirectory(newDirRel);
							fileUploadService.updateFileUpload(fu.getIdFileUpload(),fu);
							
						}
						else lg.info("NoMOV : "+newFile.getCanonicalPath());
						
					}
					else lg.info("Skipping non IMPORTED file "+fu.getDirectory()+File.separator+fu.getName());
				}
			}
		} catch (Exception ioex) {
			lg.error(IO.getStackTrace(ioex));
			return false;
		}
		return true;

	}

	
	
	 /***************************************************
	 * URL: /submit/parse/chip/
	 * post(): call chip parser
	 * @param input : input filename
	 * @param output: output filename
	 * @param chromosome: column index chromsome
	 * @param start: column index start
	 * @param end: column index stop
	 * @param log: column index log ratio
	 * @param fdr: column index fdr
	 * @param idParent: reference to the uploaded file
	 * @param idAnalysisType: reference to the analysis type
	 * @param idFileUpload: reference to fileUpload
	 * @return FileUpload: file upload object
	 ****************************************************/
	@RequestMapping(value="parse/chip", method = RequestMethod.POST)
	@ResponseBody 
	public FileUpload parseChip(
			@RequestParam("inputFile") String input, 
			@RequestParam("outputFile") String output,
			@RequestParam("Chromosome") Integer chrom, 
			@RequestParam("Start") Integer start, 
			@RequestParam("End") Integer end,
			@RequestParam("Log2Ratio") Integer log, 
			@RequestParam("FDR") Integer fdr, 
			@RequestParam("build") Long idOrganismBuild, 
			@RequestParam("idProject") String id, 
			@RequestParam("-10*log10(FDR)") Integer logFDR, 
			@RequestParam("idParent") Long idParent,
			@RequestParam("idAnalysisType") Long idAnalysisType,
			@RequestParam("idFileUpload") Long idFileUpload) {
 
		FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);

		try {
			
			OrganismBuild gb = organismBuildService.getOrganismBuildById(idOrganismBuild);
			AnalysisType at = analysisTypeService.getAnalysisTypeById(idAnalysisType);
			Project project = projectService.getProjectById(Long.parseLong(id));
			Genome genome = null;
			
			//Try to get genome build
			try {
				genome = GenomeBuilds.fetchGenome(gb);
			} catch (Exception ex) {
				ex.printStackTrace();
				fileUpload.setMessage(String.format(ex.getMessage(), gb.getName()));
				fileUpload.setState(FileStateEnum.FAILURE);
				return fileUpload;
			}
			
			//Get and create necessary directories.
			File importDir = new File(getRawDirectory(),id);
			File parseDir = fetchAnnotatedParseDirectory(gb, at, project);

			File inputFile = new File(importDir, input);
			File outputFile = new File(parseDir, output);

			//Add gz extension if it doesn't exist
			if (!outputFile.getName().endsWith(".gz")) outputFile = new File(outputFile.getParent(),outputFile.getName() + ".gz");
			
			//Run parser, throw errors if log2 or FDR are not set
			String warningMessage = "";
			if (fdr != -1) {
				ChipParser cp = new ChipParser(inputFile, outputFile, chrom, start, end, fdr, log, false, genome);
				warningMessage = cp.run();
			} else if (logFDR != 1) {
				ChipParser cp = new ChipParser(inputFile, outputFile, chrom, start, end, logFDR, log, true, genome);
				warningMessage = cp.run();
			} else {
				fileUpload.setMessage("Neither FDR or 10*log10(FDR) were set.");
				fileUpload.setState(FileStateEnum.FAILURE);
				return fileUpload;
			}
			
			fileUpload.setMessage(warningMessage);
		
			fileUpload.setName(outputFile.getName());
			
			//make relative path for dir
			File localDirectory = new File(BiominerProperties.getProperty("filePath"));
			String ld = localDirectory.getCanonicalPath();
			String dir = outputFile.getParent().replace(ld, "");
			fileUpload.setDirectory(dir);
			fileUpload.setSize(new Long(outputFile.length()));
			fileUpload.setAnalysisType(at);
			
			fileUploadService.updateFileUpload(idFileUpload,fileUpload);
			
			//set state after, so finalize works
			if (warningMessage.equals("")) {
				fileUpload.setState(FileStateEnum.SUCCESS);
			} else {
				fileUpload.setState(FileStateEnum.WARNING);
			}
			
			
			
			
		} catch (Exception ioex) {
			fileUpload.setState(FileStateEnum.FAILURE);
			fileUpload.setMessage(ioex.getMessage());
		}
		
		return fileUpload;
	}
	
	/**
	 * @param labs: Lab objects to extract first and last names, combine if different, and clean of non file name friendly characters.
	 * @return String: merged lab names ready for inclusion in a file path.
	 * */
	public static String fetchMergedLabNames(List<Lab> labs){
		StringBuilder sb = new StringBuilder();
		//set first
		Lab firstLab = labs.get(0);
		String name = firstLab.getFirst();
		if (name.equals(firstLab.getLast())) sb.append(cleanForFileName(name));
		else {
			sb.append(cleanForFileName(name));
			sb.append(cleanForFileName(firstLab.getLast()));
		}

		for (int i=1; i< labs.size(); i++) {
			sb.append("_");
			Lab lab = labs.get(i);
			String labName = lab.getFirst();
			if (labName.equals(lab.getLast())) sb.append(cleanForFileName(labName));
			else {
				sb.append(cleanForFileName(labName));
				sb.append(cleanForFileName(lab.getLast()));
			}
		}
		return sb.toString();
	}
	
	/**
	 * @param raw: String to be stripped of whitespace and non-word characters.
	 * @return String: cleaned String
	 * */
	public static String cleanForFileName(String raw){
		String clean = WHITE_SPACE.matcher(raw).replaceAll("");
		clean = NON_WORD.matcher(clean).replaceAll("");
		return clean;
	}
	
	public File fetchAnnotatedParseDirectory(OrganismBuild ob, AnalysisType at, Project project ) throws Exception{
	
		StringBuilder sb = new StringBuilder();
		//GenomeBuild
		
		sb.append(cleanForFileName(ob.getName()));
		sb.append(File.separator);
		
		//Institute concat
		List<Institute> is = project.getInstitutes();
		sb.append(cleanForFileName(is.get(0).getName()));
		for (int i=1; i< is.size(); i++) {
			sb.append("_");
			sb.append(cleanForFileName(is.get(i).getName()));
		}
		sb.append(File.separator);
		
		//Lab concat
		sb.append(fetchMergedLabNames(project.getLabs()));
		sb.append(File.separator);
		
		//ProjectName
		sb.append(cleanForFileName(project.getName()));
		sb.append(File.separator);
		
		//AnalysisType
		sb.append(cleanForFileName(at.getType().toString()));
		
		File dir = new File (getParsedDirectory(), sb.toString());
		dir.mkdirs();
		if (dir.exists() == false) throw new IOException("Failed to create an annotated directory path for "+sb);
		return dir;
		
	}
	
	/***************************************************
	 * URL: /submit/parse/rnaseq/
	 * post(): call rnaseq parser
	 * @param input : input filename
	 * @param output: output filename
	 * @param gene: gene name
	 * @param log: column index log ratio
	 * @param fdr: column index fdr
	 * @param idParent: reference to the uploaded file
	 * @param idAnalysisType: reference to the analysis type
	 * @param idFileUpload: reference to the FileUpload
	 * @return FileUpload: file upload object
	 ****************************************************/
	@RequestMapping(value="parse/rnaseq", method = RequestMethod.POST)
	@ResponseBody 
	public FileUpload parseRnaseq(
			@RequestParam("inputFile") String input, 
			@RequestParam("outputFile") String output,
			@RequestParam("Gene") Integer gene,
			@RequestParam("Log2Ratio") Integer log, 
			@RequestParam("FDR") Integer fdr, 
			@RequestParam("build") Long idOrganismBuild, 
			@RequestParam("idProject") String id, 
			@RequestParam("-10*log10(FDR)") Integer logFDR, 
			@RequestParam("idParent") Long idParent,
			@RequestParam("idAnalysisType") Long idAnalysisType,
			@RequestParam("idFileUpload") Long idFileUpload) {
 
		FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
		
		try {
			
			OrganismBuild gb = organismBuildService.getOrganismBuildById(idOrganismBuild);
			AnalysisType at = analysisTypeService.getAnalysisTypeById(idAnalysisType);
			Project project = projectService.getProjectById(Long.parseLong(id));
			
			List<ExternalGene> egList = this.externalGeneService.getExternalGenesByOrganismBuild(gb);
			
			Genome genome = null;
			try {
				genome = GenomeBuilds.fetchGenome(gb);
			} catch (Exception ex) {
				ex.printStackTrace();
				fileUpload.setMessage(String.format(ex.getMessage(), gb.getName()));
				fileUpload.setState(FileStateEnum.FAILURE);
				return fileUpload;
			}
			File importDir = new File(getRawDirectory(),id);
			File parseDir = fetchAnnotatedParseDirectory(gb, at, project);
			File inputFile = new File(importDir, input);
			File outputFile = new File(parseDir, output);
			
			//Add gz extension if it doesn't exist
			if (!outputFile.getName().endsWith(".gz")) outputFile = new File(outputFile.getParent(),outputFile.getName() + ".gz");

			//Run parser, throw errors if log2 or FDR are not set
			String warningMessage = "";
			if (fdr != -1) {
				RnaSeqParser rp = new RnaSeqParser(inputFile, outputFile, gene, fdr, log, false, egList, genome);
				warningMessage = rp.run();
			} else if (logFDR != 1) {
				RnaSeqParser rp = new RnaSeqParser(inputFile, outputFile, gene, logFDR, log, true, egList, genome);
				warningMessage = rp.run();
			} else {
				fileUpload.setMessage("Neither FDR or 10*log10(FDR) were set.");
				fileUpload.setState(FileStateEnum.FAILURE);
				return fileUpload;
			}

			fileUpload.setMessage(warningMessage);
			fileUpload.setName(outputFile.getName());
			
			//make relative path for dir
			File localDirectory = new File(BiominerProperties.getProperty("filePath"));
			String ld = localDirectory.getCanonicalPath();
			String dir = outputFile.getParent().replace(ld, "");
			fileUpload.setDirectory(dir);
			fileUpload.setSize(new Long(outputFile.length()));
			fileUpload.setAnalysisType(at);
			
			fileUploadService.updateFileUpload(idFileUpload,fileUpload);
			
			//set state after, so finalize works
			if (warningMessage.equals("")) {
				fileUpload.setState(FileStateEnum.SUCCESS);
			} else {
				fileUpload.setState(FileStateEnum.WARNING);
			}
			
			//Read in header and try to parse condition information
			BufferedReader br = IO.fetchBufferedReader(inputFile);
			String[] header = br.readLine().split("\t");
			
			br.close();
			String log2FC = header[log];
			Pattern p = Pattern.compile("(.+):(.+)\\s+.+");
			Matcher m = p.matcher(log2FC);
			if (m.matches()) {
				String cond1 = m.group(1);
				String cond2 = m.group(2);
				String name = FilenameUtils.getBaseName(outputFile.getName());
				submitController.autoCreateAnalysis(Long.parseLong(id), idFileUpload, idAnalysisType, cond1, cond2, name);
			} 
			
			
		} catch (Exception ioex) {
			ioex.printStackTrace();
			fileUpload.setState(FileStateEnum.FAILURE);
			fileUpload.setMessage(ioex.getMessage());
		}
		return fileUpload;
	}
	
	/***************************************************
	 * URL: /submit/parse/variant/
	 * post(): call variant parser
	 * @param input : input filename
	 * @param output: output filename
	 * @param idParent: reference to the file parent
	 * @param idAnalysisType: reference to the analysis type
	 * @param idFileUpload: reference to the file upload object
	 * @return FileUpload: File Upload Object
	 ****************************************************/
	@RequestMapping(value="parse/variant", method = RequestMethod.POST)
	@ResponseBody 
	public FileUpload parseVariant(
			@RequestParam("inputFile") String input, 
			@RequestParam("outputFile") String output,
			@RequestParam("build") Long idOrganismBuild, 
			@RequestParam("idProject") String id, 
			@RequestParam("idParent") Long idParent,
			@RequestParam("idAnalysisType") Long idAnalysisType,
			@RequestParam("idFileUpload") Long idFileUpload) {
 
		FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
		
		try {
			
			OrganismBuild gb = organismBuildService.getOrganismBuildById(idOrganismBuild);
			AnalysisType at = analysisTypeService.getAnalysisTypeById(idAnalysisType);
			Project project = projectService.getProjectById(Long.parseLong(id));
			
			List<ExternalGene> egList = this.externalGeneService.getExternalGenesByOrganismBuild(gb);

			Genome genome = null;
			try {
				genome = GenomeBuilds.fetchGenome(gb);
			} catch (Exception ex) {
				ex.printStackTrace();
				fileUpload.setState(FileStateEnum.FAILURE);
				fileUpload.setMessage(String.format(ex.getMessage(), gb.getName()));
				return fileUpload;
			}
			File importDir = new File(getRawDirectory(),id);
			File parseDir = fetchAnnotatedParseDirectory(gb, at, project);
			
			File inputFile = new File(importDir, input);
			File outputFile = new File(parseDir, output);
			
			//Add gz extension if it doesn't exist
			if (!outputFile.getName().endsWith(".gz")) {
				outputFile = new File(outputFile.getParent(),outputFile.getName() + ".gz");
			}
			
			//Run parser, throw errors if log2 or FDR are not set
			String warningMessage = "";
			
			VCFParser vp = new VCFParser(inputFile, outputFile, egList, genome);
			warningMessage = vp.run();
			
			fileUpload.setMessage(warningMessage);
			fileUpload.setName(outputFile.getName());
			fileUpload.setSize(new Long(outputFile.length()));
			fileUpload.setAnalysisType(at);
			
			//make relative path for dir
			File localDirectory = new File(BiominerProperties.getProperty("filePath"));
			String ld = localDirectory.getCanonicalPath();
			String dir = outputFile.getParent().replace(ld, "");
			fileUpload.setDirectory(dir);
			
			fileUploadService.updateFileUpload(idFileUpload,fileUpload);
			
			//Set state after
			if (warningMessage.equals("")) {
				fileUpload.setState(FileStateEnum.SUCCESS);
			} else {
				fileUpload.setState(FileStateEnum.WARNING);
			}
			
		} catch (Exception ioex) {
			ioex.printStackTrace();
		    fileUpload.setState(FileStateEnum.FAILURE);
			fileUpload.setMessage(ioex.getMessage());
		}
		
		return fileUpload;
	}
	
	private BooleanModel checkFile(File[] filePaths) {
		BooleanModel bm = new BooleanModel();
		bm.setFound(false);
		for (File fp: filePaths) {
			if (fp.exists()) bm.setFound(true);
		}
		return bm;
	}
	
	@RequestMapping(value="finalizeFileUpload", method=RequestMethod.PUT)
	@ResponseBody
	public void finalizeFileUpload(@RequestParam("idFileUpload") Long idFileUpload, @RequestParam("state") FileStateEnum state) {
		FileUpload fu = fileUploadService.getFileUploadById(idFileUpload);
		fu.setState(state);
		fileUploadService.updateFileUpload(idFileUpload, fu);
	}
	
	@RequestMapping(value="doesRawUploadExist", method = RequestMethod.GET)
	@ResponseBody 
	public BooleanModel doesRawUploadExist(@RequestParam("idProject") Long idProject, @RequestParam("fileName") String fileName) throws Exception {
		File projectDirectory = new File(FileController.getRawDirectory(),idProject.toString());
		File[] filePaths = new File[2];
		filePaths[0] = new File(projectDirectory,fileName);
		filePaths[1]= new File(projectDirectory,fileName + ".gz");
		return checkFile(filePaths);
	}
	
	@RequestMapping(value="doesParsedUploadExist", method = RequestMethod.GET)
	@ResponseBody 
	public BooleanModel doesParsedUploadExist(@RequestParam("idProject") Long idProject, @RequestParam("fileName") String fileName) throws Exception {
		File projectDirectory = new File(FileController.getParsedDirectory(),idProject.toString());
		File[] filePaths = new File[2];
		filePaths[0] = new File(projectDirectory,fileName);
		filePaths[1] = new File(projectDirectory,fileName + ".gz");
		return checkFile(filePaths);
	}
	
	@RequestMapping(value="doesDatatrackExist", method = RequestMethod.GET)
	@ResponseBody 
	public BooleanModel doesDatatrackExist(@RequestParam("idProject") Long idProject, @RequestParam("fileName") String fileName) throws Exception {
		File projectDirectory = new File(FileController.getIgvDirectory(),idProject.toString());
		File[] filePaths = new File[2];
		filePaths[0] = new File(projectDirectory,fileName);
		filePaths[1] = new File(projectDirectory,fileName + ".gz");
		return checkFile(filePaths);
	}
	
	@RequestMapping(value="getParsedUploadNames", method=RequestMethod.GET)
	@ResponseBody
	public List<String> getParsedUploadNames(@RequestParam("idProject") Long idProject) throws Exception {
		Project project = projectService.getProjectById(idProject);
		List<FileUpload> files = fileUploadService.getFileUploadByType(FileTypeEnum.IMPORTED, project);
		
		List<String> fileNames = new ArrayList<String>();
		for (FileUpload f: files) {
			fileNames.add(f.getName());
		}
		return fileNames;
	}
	
	@RequestMapping(value="cleanUploadedFiles", method=RequestMethod.DELETE)
	@ResponseBody
	public List<Long> cleanUploadedFiles(@RequestParam("idProject") Long idProject) throws Exception {
		Project project = projectService.getProjectById(idProject);
		List<FileUpload> ful = fileUploadService.getFileUploadByProject(project);
		List<Long> idList = new ArrayList<Long>();
		
		for (FileUpload fu: ful) {
			FileStateEnum state = fu.getState();
			if (state == FileStateEnum.FAILURE || state == FileStateEnum.INCOMPLETE) {
				deleteFile(fu.getIdFileUpload());
				idList.add(fu.getIdFileUpload());
			}
		}
		
		return idList;
	}
	
	private void deleteFile(Long idFileUpload) throws Exception {
		FileUpload fileUpload = fileUploadService.getFileUploadById(idFileUpload);
		File fileToDelete = generateFilePath(fileUpload);
		 if (fileToDelete.exists()) fileToDelete.delete();
		 fileUploadService.deleteFileUploadById(idFileUpload);
	}
	
	/**** 
	 * uploadSampleSheet: Input is a file object that should represent a GNomEx sample sheet.  This method uploads the file,
	 * parses the file to remove unused columns and then returns a preview of the file.
	 * @param MultipartFile file: Sample sheet
	 * @param Long idProject: project identifier
	 * @return PreviewMap: Object that contains the first 20 lines of the file, with meaningless columns removed
	 */
	@RequestMapping(value="uploadSampleSheet", method=RequestMethod.POST)
	@ResponseBody
	public PreviewMap uploadSampleSheet(HttpServletResponse response, @RequestParam("file") MultipartFile file, @RequestParam("idProject") Long idProject) {
		PreviewMap pm = new PreviewMap();
		
		File localFile = null;
		
		try {
			//Create the project directory, if it doens't exist
			File directory = new File(getRawDirectory(),String.valueOf(idProject));
			if (!directory.exists()) {
				directory.mkdir();
			}
			
			//Copy the file to the server (file is restricted to 1GB, so no chunking is necessary
			localFile = new File(directory, file.getName());
			if (localFile.exists()) {
				localFile.delete();
			}
			
			FileCopyUtils.copy(file.getInputStream(),new FileOutputStream(localFile));

			//Read through file and identify columns with missing data.
			BufferedReader br = ModelUtil.fetchBufferedReader(localFile);

			String headerLine = br.readLine();
			if (headerLine == null) {
				pm.setMessage("This file appears to be empty, are you sure you uploaded the correct file?");
				response.setStatus(500);
				if (localFile.exists()) {
					localFile.delete();
				}
				return pm;
			}
			if (!IO.isASCII(headerLine)) {
				pm.setMessage("This file appears to be in binary, are you sure you uploaded the correct file?");
				response.setStatus(500);
				if (localFile.exists()) {
					localFile.delete();
				}
				return pm;
			}

			String[] header = headerLine.split("\t"); //Read in the header

			boolean[] missingList = new boolean[header.length];
			for (int i=0; i<missingList.length;i++) {
				missingList[i] = false;
			}

			String line = null;
			int lineCount = 1;

			while ((line = br.readLine()) != null) {
				String[] values = line.split("\t");
				if (values.length != header.length) {
					pm.setMessage("Line " + lineCount + " has a different number of tab-delimited fields than the header.");
					if (localFile.exists()) {
						localFile.delete();
					}
					response.setStatus(500);
					return pm;
				}

				for (int i=0; i<values.length; i++) {
					if (values[i].equals("")) {
						missingList[i] = true;
					}
				}
				lineCount++;
			}

			br.close();

			boolean ok = false;
			for (boolean b: missingList) {
				if (!b) {
					ok = true;
				}
			}
			if (!ok) {
				pm.setMessage("None of the columns are completed for all samples, please fix the file.");
				if (localFile.exists()) {
					localFile.delete();
				}
				response.setStatus(500);
				return pm;
			}

			//Read through the file file and only write out meaningful columns
			br = ModelUtil.fetchBufferedReader(localFile);
			File parsedFile = new File(directory, "sampleSheet.txt");
			if (parsedFile.exists()) {
				parsedFile.delete();
			}
			BufferedWriter bw = new BufferedWriter(new FileWriter(parsedFile));

			lineCount = 0;
			while ((line = br.readLine()) != null) {
				String[] values = line.split("\t");
				StringBuffer sb = new StringBuffer("");
				for (int i=0; i<values.length; i++) {
					if (!missingList[i]) {
						sb.append("\t" + values[i]);
					}
				}
				String output = sb.toString().substring(1, sb.length());
				bw.write(output + "\n");

				if (lineCount < 10) {
					pm.addPreviewData(output.split("\t"));
				}
				lineCount++;
			}
			bw.close();
			br.close();

			//delete original upload
			if (localFile.exists()) {
				localFile.delete();
			}
			
		} catch (Exception ex) {
			//update file upload
			ex.printStackTrace();
			pm.setMessage("Error uploading the sample sheet: " + ex.getMessage());
			if (localFile != null && localFile.exists()) {
				localFile.delete();
			}
			response.setStatus(500);
		}
		
		return pm;
	}
	
	/** 
	 * This method deletes sampleSheet.txt if it exists. This should be called if someone cancels out of the preview.
	 * @param response: If there is an error, this will return error code and message
	 * @param Long idProject: project id, used to create sampleSheet directory
	 * @return String message: Error message if failed, OK if success.
	 */
	@RequestMapping(value="deleteSampleSheet",produces="text/plain")
	@ResponseBody
	public String deleteSampleSheet(HttpServletResponse response, @RequestParam("idProject") Long idProject) {
		try {
			//Create the project directory, if it doens't exist
			File directory = new File(getRawDirectory(),String.valueOf(idProject));
			if (!directory.exists()) {
				directory.mkdir();
			}
			
			File localFile = new File(directory, "sampleSheet.txt");
			
			if (localFile.exists()) {
				localFile.delete();
			}
		} catch (Exception ex) {
			ex.printStackTrace();
			response.setStatus(500);
			return "Problem deleting sample sheet: " + ex.getMessage();
		}
		return "OK";
	}
	
	
	
	
}
